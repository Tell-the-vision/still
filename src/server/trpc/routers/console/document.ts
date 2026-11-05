import {
  consoleDocumentCreateInput,
  consoleDocumentListInput,
  consoleDocumentUpdateInput,
  DOCUMENT_FORMATS,
  DOCUMENT_MAX_BYTES,
} from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../../../db/client";
import { documents, exhibitions } from "../../../db/schema";
import { presignPrivatePut, privateObjectSize, putPrivateObject } from "../../../media/r2";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { AppError, consoleProcedure, router } from "../../init";

const originalOf = alias(documents, "original");

// A document as the console shows it. The object key stays on the server.
const documentSelection = {
  id: documents.id,
  name: documents.originalName,
  mediaType: documents.mediaType,
  byteSize: documents.byteSize,
  category: documents.category,
  status: documents.status,
  errorCode: documents.errorCode,
  duplicateOfId: documents.duplicateOfId,
  duplicateOfName: originalOf.originalName,
  createdAt: documents.createdAt,
};
const documentView = (institutionId: string, id: string) =>
  db
    .select(documentSelection)
    .from(documents)
    .innerJoin(exhibitions, eq(exhibitions.id, documents.exhibitionId))
    .leftJoin(originalOf, and(eq(originalOf.exhibitionId, documents.exhibitionId), eq(originalOf.id, documents.duplicateOfId)))
    .where(and(eq(documents.id, id), eq(exhibitions.institutionId, institutionId)))
    .then(([row]) => row);

// The caller's exhibition for a code, or NOT_FOUND (also for another institution's).
async function exhibitionOf(institutionId: string, code: string) {
  const [row] = await exhibitionRows(institutionId, { where: eq(exhibitions.code, code) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  return row;
}

const refuse = (appCode: "SOURCE_UNSUPPORTED" | "SOURCE_TOO_LARGE") => new TRPCError({ code: "BAD_REQUEST", cause: new AppError(appCode) });

// SPEC §9.4: the declared type and size are checked before anything is stored. The extension picks the
// format and the declared media type must be that format's own; the bytes themselves are never opened here.
function checkDeclared(name: string, mediaType: string, byteSize: number) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const canonicalExt = ext === "jpeg" ? "jpg" : ext === "tif" ? "tiff" : ext;
  const format = DOCUMENT_FORMATS.find((f) => f.ext === canonicalExt);
  if (!format || format.mediaType !== mediaType) throw refuse("SOURCE_UNSUPPORTED");
  if (byteSize > DOCUMENT_MAX_BYTES) throw refuse("SOURCE_TOO_LARGE");
  return format;
}
// {institutionId}/{exhibitionId}/{documentId}/original.{ext}: the caller's own ids only, never the file name.
const objectKeyOf = (institutionId: string, exhibitionId: string, documentId: string, ext: string) =>
  `${institutionId}/${exhibitionId}/${documentId}/original.${ext}`;

// console.document.* (SPEC §9.4 업로드, §10.6, Figma A1). The browser PUTs the file to the private bucket;
// the server records the row and, after the browser reports the upload, checks the stored size.
export const consoleDocumentRouter = router({
  create: consoleProcedure.input(consoleDocumentCreateInput).mutation(async ({ ctx, input }) => {
    const exhibition = await exhibitionOf(ctx.institutionId, input.code);
    const id = randomUUID();

    if ("text" in input) {
      const bytes = Buffer.from(input.text, "utf8");
      const key = objectKeyOf(ctx.institutionId, exhibition.id, id, "txt");
      await putPrivateObject(key, bytes, "text/plain; charset=utf-8");
      await db.insert(documents).values({
        id,
        exhibitionId: exhibition.id,
        objectKey: key,
        originalName: (input.name ?? "Pasted text.txt").normalize("NFC"),
        mediaType: "text/plain",
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        category: input.category,
        status: "STORED",
        uploadedBy: ctx.session.userId,
      });
      return { document: await documentView(ctx.institutionId, id) };
    }

    const name = input.name.normalize("NFC");
    const format = checkDeclared(name, input.mediaType, input.byteSize);
    const key = objectKeyOf(ctx.institutionId, exhibition.id, id, format.ext);
    await db.insert(documents).values({
      id,
      exhibitionId: exhibition.id,
      objectKey: key,
      originalName: name,
      mediaType: format.mediaType,
      byteSize: input.byteSize,
      sha256: input.sha256,
      category: input.category,
      status: "UPLOADING",
      uploadedBy: ctx.session.userId,
    });
    const { url, headers } = await presignPrivatePut(key);
    return { document: await documentView(ctx.institutionId, id), upload: { url, method: "PUT" as const, headers } };
  }),

  update: consoleProcedure.input(consoleDocumentUpdateInput).mutation(async ({ ctx, input }) => {
    // The browser extraction module that writes manifests is not built yet (SPEC §9.4 업로드 처리 구조).
    if (input.manifestKey !== undefined) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "manifestKey is not supported until the extraction module exists." });
    }
    if (input.uploaded && input.failed) throw new TRPCError({ code: "BAD_REQUEST", message: "A document is either uploaded or failed." });
    const current = await documentView(ctx.institutionId, input.id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ objectKey, exhibitionId, sha256 }] = await db.select().from(documents).where(eq(documents.id, input.id));

    if (input.category !== undefined) {
      await db.update(documents).set({ category: input.category }).where(eq(documents.id, input.id));
    }

    if (input.failed) {
      const moved = await db
        .update(documents)
        .set({ status: "FAILED", errorCode: input.failed })
        .where(and(eq(documents.id, input.id), inArray(documents.status, ["UPLOADING", "STORED"])))
        .returning({ id: documents.id });
      if (!moved.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Only an uploading or stored document can fail." });
    }

    if (input.uploaded && current.status === "UPLOADING") {
      // The declared size is only a claim until R2 says what it holds.
      const stored = await privateObjectSize(objectKey);
      if (stored !== undefined && stored !== current.byteSize) {
        await db.update(documents).set({ status: "FAILED", errorCode: "CORRUPTED" }).where(and(eq(documents.id, input.id), eq(documents.status, "UPLOADING")));
      } else {
        // The oldest finished document of this exhibition with the same hash is the original (SPEC §10.6).
        const [original] = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.exhibitionId, exhibitionId), eq(documents.sha256, sha256), ne(documents.id, input.id), inArray(documents.status, ["STORED", "EXTRACTED"])))
          .orderBy(asc(documents.createdAt), asc(documents.id))
          .limit(1);
        await db
          .update(documents)
          .set(original ? { status: "DUPLICATE", duplicateOfId: original.id } : { status: "STORED" })
          .where(and(eq(documents.id, input.id), eq(documents.status, "UPLOADING")));
      }
    } else if (input.uploaded && current.status !== "STORED" && current.status !== "DUPLICATE") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This document is not waiting for an upload." });
    }

    return documentView(ctx.institutionId, input.id);
  }),

  // The exhibition's documents, oldest first.
  list: consoleProcedure.input(consoleDocumentListInput).query(async ({ ctx, input }) => {
    const exhibition = await exhibitionOf(ctx.institutionId, input.code);
    return db
      .select(documentSelection)
      .from(documents)
      .leftJoin(originalOf, and(eq(originalOf.exhibitionId, documents.exhibitionId), eq(originalOf.id, documents.duplicateOfId)))
      .where(eq(documents.exhibitionId, exhibition.id))
      .orderBy(asc(documents.createdAt), asc(documents.id));
  }),
});
