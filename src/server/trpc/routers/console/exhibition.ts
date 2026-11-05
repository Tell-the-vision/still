import { consoleExhibitionCursor, consoleExhibitionGetInput, consoleExhibitionListInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, count, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { contents, documents, exhibitions, venues } from "../../../db/schema";
import { draftTitle, exhibitionRows } from "../../../services/console/exhibition-rows";
import { consoleProcedure, router } from "../../init";

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
});
