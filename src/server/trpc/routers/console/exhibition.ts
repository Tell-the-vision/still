import {
  consoleExhibitionCreateInput,
  consoleExhibitionCursor,
  consoleExhibitionDeleteInput,
  consoleExhibitionGetInput,
  consoleExhibitionListInput,
} from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, count, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { isUniqueViolation } from "../../../db/errors";
import { archives, contents, documents, exhibitions, images, venues } from "../../../db/schema";
import { deleteObject } from "../../../media/r2";
import { draftTitle, exhibitionRows } from "../../../services/console/exhibition-rows";
import { AppError, consoleProcedure, router } from "../../init";

function parseCursor(cursor: string) {
  try {
    return consoleExhibitionCursor.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
  }
}

// console.exhibition.* (SPEC §9.4 목록, §9.5, Figma A8). Only the caller's institution; another
// institution's code is NOT_FOUND without revealing that it exists (SPEC §9.2 권한).
export const consoleExhibitionRouter = router({
  // Most recently updated first; fetches one extra row to know whether a next page exists.
  list: consoleProcedure.input(consoleExhibitionListInput).query(async ({ ctx, input }) => {
    const pattern = input.q ? `%${input.q}%` : null;
    const filter = and(
      input.state ? eq(exhibitions.state, input.state) : undefined,
      pattern ? or(ilike(draftTitle, pattern), ilike(venues.name, pattern)) : undefined,
    );
    const after = input.cursor ? parseCursor(input.cursor) : undefined;
    const rows = await exhibitionRows(ctx.institutionId, {
      where: and(filter, after && sql`(${exhibitions.updatedAt}, ${exhibitions.id}) < (${after.updatedAt}::timestamptz, ${after.id}::uuid)`),
      limit: input.limit + 1,
    });
    const items = rows.slice(0, input.limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > input.limit && last ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt, id: last.id })).toString("base64url") : null;
    const totalSize = (await exhibitionRows(ctx.institutionId, { where: filter })).length;
    return { items, nextCursor, totalSize };
  }),

  // The exhibition with its draft and analysis summary, plus item counts for the overview (Figma A3).
  get: consoleProcedure.input(consoleExhibitionGetInput).query(async ({ ctx, input }) => {
    const [row] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ draft, analysis }] = await db.select({ draft: exhibitions.draft, analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, row.id));
    const contentCounts = await db
      .select({ status: contents.status, n: count() })
      .from(contents)
      .where(eq(contents.exhibitionId, row.id))
      .groupBy(contents.status);
    const byStatus = Object.fromEntries(contentCounts.map((c) => [c.status, c.n]));
    return {
      ...row,
      draft,
      analysis,
      counts: {
        documents: await db.$count(documents, eq(documents.exhibitionId, row.id)),
        contents: {
          ready: byStatus.READY ?? 0,
          needsReview: byStatus.NEEDS_REVIEW ?? 0,
          approved: byStatus.APPROVED ?? 0,
          rejected: byStatus.REJECTED ?? 0,
        },
      },
    };
  }),

  // A new draft (SPEC §9.4 전시 초안, §10.3): the code was confirmed by the institution and never changes.
  create: consoleProcedure.input(consoleExhibitionCreateInput).mutation(async ({ ctx, input }) => {
    const draft = {
      version: 1,
      title: input.title,
      subtitle: null,
      venueId: null,
      startDate: null,
      endDate: null,
      coverImageId: null,
      ambienceEnabled: false,
      playlist: null,
      sections: [],
    };
    try {
      const [created] = await db
        .insert(exhibitions)
        .values({ code: input.code, institutionId: ctx.institutionId, title: input.title, state: "DRAFT", draft, createdBy: ctx.session.userId })
        .returning({ id: exhibitions.id });
      const [row] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.id, created.id) });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new TRPCError({ code: "CONFLICT", cause: new AppError("CODE_TAKEN") });
      throw error;
    }
  }),

  // Deletes an exhibition nobody has used (SPEC §10.9 전시 삭제): not published, no visitor archive.
  // The row lock serializes with publishing and with a visitor creating an archive (its foreign key
  // check waits for the lock), so neither can slip in between the checks and the delete.
  delete: consoleProcedure.input(consoleExhibitionDeleteInput).mutation(async ({ ctx, input }) => {
    const objectKeys = await db.transaction(async (tx) => {
      const [exhibition] = await tx
        .select({ id: exhibitions.id, state: exhibitions.state })
        .from(exhibitions)
        .where(and(eq(exhibitions.institutionId, ctx.institutionId), eq(exhibitions.code, input.code)))
        .for("update");
      if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
      if (exhibition.state === "PUBLISHED") throw new TRPCError({ code: "CONFLICT", cause: new AppError("EXHIBITION_PUBLISHED") });
      if (await tx.$count(archives, eq(archives.exhibitionId, exhibition.id))) {
        throw new TRPCError({ code: "CONFLICT", cause: new AppError("EXHIBITION_HAS_ARCHIVES") });
      }
      const documentKeys = await tx
        .select({ key: documents.objectKey, manifestKey: documents.manifestObjectKey })
        .from(documents)
        .where(eq(documents.exhibitionId, exhibition.id));
      const imageKeys = await tx.select({ key: images.objectKey }).from(images).where(eq(images.exhibitionId, exhibition.id));
      // Documents, contents and images go with the row (ON DELETE CASCADE).
      await tx.delete(exhibitions).where(eq(exhibitions.id, exhibition.id));
      return [...documentKeys.flatMap((d) => [d.key, d.manifestKey]), ...imageKeys.map((i) => i.key)].filter((key) => key !== null);
    });
    // Best effort after commit. TODO: SPEC queues these as `storage.delete` jobs (pg-boss), which do not exist yet.
    await Promise.allSettled(objectKeys.map(deleteObject));
  }),
});
