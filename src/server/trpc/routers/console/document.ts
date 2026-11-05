import {
  consoleDocumentCreateInput,
  consoleDocumentDeleteInput,
  consoleDocumentGetInput,
  consoleDocumentListInput,
  consoleDocumentUpdateInput,
  DOCUMENT_FORMATS,
  DOCUMENT_MAX_BYTES,
} from "@still/shared/console";
import { getBoss, VERIFY_QUEUE } from "../../../services/console/analysis-jobs";
import { enqueueStorageDeletes } from "../../../services/console/storage-jobs";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../../../db/client";
import { contents, documents, exhibitions, images } from "../../../db/schema";
import { presignPrivateGet, presignPrivatePut, privateObjectSize, putPrivateObject } from "../../../media/r2";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { documentPrefix, manifestVersionOf, validateManifest } from "../../../services/console/manifests";
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
    if ([input.uploaded, input.failed, input.manifestKey].filter((v) => v !== undefined).length > 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A document is uploaded, failed or extracted, one at a time." });
    }
    const current = await documentView(ctx.institutionId, input.id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ objectKey, exhibitionId, sha256 }] = await db.select().from(documents).where(eq(documents.id, input.id));

    if (input.category !== undefined) {
      await db.update(documents).set({ category: input.category }).where(eq(documents.id, input.id));
    }

    if (input.manifestKey !== undefined) {
      await recordManifest(ctx.institutionId, input.id, input.manifestKey);
      const [unverified] = await db.select({ id: images.id }).from(images).where(and(eq(images.documentId, input.id), eq(images.verification, "UNVERIFIED"))).limit(1);
      if (unverified) await (await getBoss()).send(VERIFY_QUEUE, { documentId: input.id }, { retryLimit: 2 });
      return documentView(ctx.institutionId, input.id);
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
      // A missing object is as bad as a wrong-sized one: the browser reported an upload that is not there.
      if (stored === null || stored !== current.byteSize) {
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

  // The document and a presigned GET for its original.
  get: consoleProcedure.input(consoleDocumentGetInput).query(async ({ ctx, input }) => {
    const document = await documentView(ctx.institutionId, input.id);
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ objectKey }] = await db.select({ objectKey: documents.objectKey }).from(documents).where(eq(documents.id, input.id));
    return { ...document, download: await presignPrivateGet(objectKey) };
  }),

  // SPEC §9.1-1: an original goes only while nothing refers to it. ZIP children and duplicates go with it
  // (self FKs), and so do the images extracted from any of them (images_document_fk).
  delete: consoleProcedure.input(consoleDocumentDeleteInput).mutation(async ({ ctx, input }) => {
    const current = await documentView(ctx.institutionId, input.id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND" });

    const boss = await getBoss();
    await db.transaction(async (tx) => {
      const [{ exhibitionId }] = await tx.select({ exhibitionId: documents.exhibitionId }).from(documents).where(eq(documents.id, input.id));
      // Locking the exhibition row keeps two deletes (and any writer that takes the same lock) from
      // interleaving with the checks below.
      const [exhibition] = await tx
        .select({ analysis: exhibitions.analysis, draft: exhibitions.draft, coverImageId: exhibitions.coverImageId })
        .from(exhibitions)
        .where(eq(exhibitions.id, exhibitionId))
        .for("update");
      // The row may have been deleted by a concurrent request while we waited for the lock.
      const doomed = await documentsGoingWith(tx, exhibitionId, input.id);
      if (!doomed.length) throw new TRPCError({ code: "NOT_FOUND" });

      const analysis = exhibition.analysis as { result?: unknown } | null;
      if (analysis && analysis.result == null) throw new TRPCError({ code: "CONFLICT", cause: new AppError("ANALYSIS_IN_PROGRESS") });
      await assertUnreferenced(tx, exhibitionId, exhibition, doomed.map((d) => d.id));

      await tx.delete(documents).where(eq(documents.id, input.id));
      // Queued in this transaction (SPEC §10.11): the jobs exist exactly when the rows are gone.
      const keys = doomed.flatMap((d) => [d.objectKey, d.manifestObjectKey]).filter((key): key is string => key !== null);
      await enqueueStorageDeletes(boss, tx, keys.map((key) => ({ bucket: "private", key })));
    });
    return { id: input.id };
  }),
});

// SPEC §10.6 상태 전이 STORED → EXTRACTED (and EXTRACTED → EXTRACTED for a new manifest version): the
// manifest is validated, then the document and its image rows change together. An invalid manifest is not an
// error: the document becomes FAILED / MANIFEST_INVALID and the caller reads that from the returned row.
// The `document.verify` job (pg-boss) will later move images off UNVERIFIED; here they are only recorded.
async function recordManifest(institutionId: string, id: string, manifestKey: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (doc.status !== "STORED" && doc.status !== "EXTRACTED") throw new TRPCError({ code: "BAD_REQUEST", message: "Only a stored document can be extracted." });
  const prefix = documentPrefix(institutionId, doc.exhibitionId, id);
  const version = manifestVersionOf(prefix, manifestKey);
  if (version === null) throw new TRPCError({ code: "BAD_REQUEST", message: "manifestKey must be this document's manifest.v{n}.json." });
  const current = doc.manifestObjectKey ? manifestVersionOf(prefix, doc.manifestObjectKey) : null;
  if (current !== null && version <= current) throw new TRPCError({ code: "BAD_REQUEST", message: "A re-extraction needs a newer manifest version." });

  const boss = await getBoss();
  const checked = await validateManifest({ id, sha256: doc.sha256, prefix }, manifestKey);

  await db.transaction(async (tx) => {
    const [exhibition] = await tx
      .select({ draft: exhibitions.draft, coverImageId: exhibitions.coverImageId })
      .from(exhibitions)
      .where(eq(exhibitions.id, doc.exhibitionId))
      .for("update");
    // Only the state read above may be replaced: a concurrent update wins and this one is refused.
    const [locked] = await tx.select({ status: documents.status, manifestObjectKey: documents.manifestObjectKey }).from(documents).where(eq(documents.id, id)).for("update");
    if (locked.status !== doc.status || locked.manifestObjectKey !== doc.manifestObjectKey) throw new TRPCError({ code: "CONFLICT", message: "The document changed meanwhile." });

    if (!checked) {
      await tx.update(documents).set({ status: "FAILED", errorCode: "MANIFEST_INVALID", manifestObjectKey: null }).where(eq(documents.id, id));
      return;
    }
    if (doc.status === "EXTRACTED") await assertUnreferenced(tx, doc.exhibitionId, exhibition, [id]);
    // The replaced extraction's outputs: its old manifest and any public image files.
    const replaced = await tx.select({ key: images.objectKey }).from(images).where(eq(images.documentId, id));
    await enqueueStorageDeletes(boss, tx, [
      ...(doc.manifestObjectKey ? [{ bucket: "private" as const, key: doc.manifestObjectKey }] : []),
      ...replaced.flatMap((i) => (i.key ? [{ bucket: "public" as const, key: i.key }] : [])),
    ]);
    await tx.delete(images).where(eq(images.documentId, id));
    if (checked.assets.length) {
      await tx.insert(images).values(
        checked.assets.map((asset) => ({
          exhibitionId: doc.exhibitionId,
          objectKey: null,
          width: asset.pixels[0],
          height: asset.pixels[1],
          documentId: id,
          manifestAssetId: asset.id,
          rights: "UNCONFIRMED",
          verification: asset.sourceRange ? "UNVERIFIED" : "NOT_APPLICABLE",
        })),
      );
    }
    await tx.update(documents).set({ status: "EXTRACTED", errorCode: null, manifestObjectKey: manifestKey, analyzedAt: null }).where(eq(documents.id, id));
  });
}

// SPEC §9.1-1: documents (and the images extracted from them) stay while the draft cover, or any content, refers
// to them: by image id, or by a source ref "{documentId}:…". Call with the exhibition row locked.
async function assertUnreferenced(
  tx: Pick<typeof db, "select">,
  exhibitionId: string,
  exhibition: { draft: unknown; coverImageId: string | null },
  documentIds: string[],
) {
  const theirImages = await tx.select({ id: images.id }).from(images).where(inArray(images.documentId, documentIds));
  const imageIds = new Set(theirImages.map((i) => i.id));
  const draftCover = (exhibition.draft as { coverImageId?: string | null }).coverImageId;
  const coverIsTheirs = [exhibition.coverImageId, draftCover].some((cover) => cover && imageIds.has(cover));
  const items = await tx.select({ blocks: contents.blocks, fields: contents.fields }).from(contents).where(eq(contents.exhibitionId, exhibitionId));
  const refersToThem = (value: string) => imageIds.has(value) || documentIds.some((id) => value.startsWith(`${id}:`));
  if (coverIsTheirs || items.some((item) => stringsIn(item).some(refersToThem))) {
    throw new TRPCError({ code: "CONFLICT", cause: new AppError("DOCUMENT_IN_USE") });
  }
}

// The document with its ZIP children and duplicates, transitively: every row the delete cascades to.
async function documentsGoingWith(tx: Pick<typeof db, "execute">, exhibitionId: string, id: string) {
  const { rows } = await tx.execute<{ id: string; objectKey: string; manifestObjectKey: string | null }>(sql`
    WITH RECURSIVE going AS (
      SELECT id, object_key, manifest_object_key FROM documents WHERE exhibition_id = ${exhibitionId} AND id = ${id}
      UNION
      SELECT d.id, d.object_key, d.manifest_object_key FROM documents d
        JOIN going g ON d.parent_id = g.id OR d.duplicate_of_id = g.id
        WHERE d.exhibition_id = ${exhibitionId}
    )
    SELECT id, object_key AS "objectKey", manifest_object_key AS "manifestObjectKey" FROM going`);
  return rows;
}

// Every string anywhere in a JSON value: content refs ("{documentId}:{segmentId}") and image ids are found
// without caring which block or field holds them, so a new place for refs cannot be missed.
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}
