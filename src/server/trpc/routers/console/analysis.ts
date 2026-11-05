import { consoleAnalysisGetInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { contents, documents, exhibitions } from "../../../db/schema";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { consoleProcedure, router } from "../../init";

// Rows of one exhibition counted per status.
async function countByStatus(table: typeof documents | typeof contents, exhibitionId: string) {
  const rows = await db.select({ status: table.status, n: count() }).from(table).where(eq(table.exhibitionId, exhibitionId)).groupBy(table.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number | undefined>;
}
const total = (counts: Record<string, number | undefined>) => Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);

// console.analysis.* (SPEC §9.4 진행 표시, §10.10, Figma A3). Only the read side exists until
// pg-boss and the Worker land.
export const consoleAnalysisRouter = router({
  // The overview's processing state: the current analysis plus document and content counts.
  // `jobs` is the pg-boss job list (SPEC §9.5); it stays empty until pg-boss exists.
  get: consoleProcedure.input(consoleAnalysisGetInput).query(async ({ ctx, input }) => {
    const [row] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ analysis }] = await db.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, row.id));
    const docs = await countByStatus(documents, row.id);
    const items = await countByStatus(contents, row.id);
    return {
      analysis,
      documents: {
        total: total(docs),
        uploading: docs.UPLOADING ?? 0,
        stored: docs.STORED ?? 0,
        extracted: docs.EXTRACTED ?? 0,
        failed: docs.FAILED ?? 0,
        duplicate: docs.DUPLICATE ?? 0,
      },
      contents: { total: total(items), open: (items.READY ?? 0) + (items.NEEDS_REVIEW ?? 0) },
      jobs: [] as never[],
    };
  }),
});
