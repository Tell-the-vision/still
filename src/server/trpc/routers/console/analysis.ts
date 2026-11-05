import { consoleAnalysisGetInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db/client";
import { contents, documents, exhibitions } from "../../../db/schema";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { getBoss, ANALYSIS_QUEUE } from "../../../services/console/analysis-jobs";
import { AppError, consoleProcedure, router } from "../../init";

// Rows of one exhibition counted per status.
async function countByStatus(table: typeof documents | typeof contents, exhibitionId: string) {
  const rows = await db.select({ status: table.status, n: count() }).from(table).where(eq(table.exhibitionId, exhibitionId)).groupBy(table.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number | undefined>;
}
const total = (counts: Record<string, number | undefined>) => Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);

// Locks the exhibition row of `code` (owned by the caller's institution) and returns it with its analysis.
async function lockExhibition(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], institutionId: string, code: string) {
  const [row] = await exhibitionRows(institutionId, { where: eq(exhibitions.code, code) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const [{ analysis }] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, row.id)).for("update");
  return { id: row.id, analysis: analysis as { id: string; result: string | null } | null };
}

// console.analysis.* (SPEC §9.4 진행 표시, §9.5, §10.10, Figma A3).
export const consoleAnalysisRouter = router({
  // Starts an analysis of the EXTRACTED documents not analyzed yet. The job is enqueued right after the
  // commit (not in the same transaction), so a crash in between leaves an analysis that never finishes.
  create: consoleProcedure.input(consoleAnalysisGetInput).mutation(async ({ ctx, input }) => {
    const job = await db.transaction(async (tx) => {
      const exhibition = await lockExhibition(tx, ctx.institutionId, input.code);
      if (exhibition.analysis && exhibition.analysis.result === null) throw new TRPCError({ code: "CONFLICT", cause: new AppError("ANALYSIS_IN_PROGRESS") });
      const targets = await tx.select({ id: documents.id }).from(documents)
        .where(and(eq(documents.exhibitionId, exhibition.id), eq(documents.status, "EXTRACTED"), isNull(documents.analyzedAt)));
      if (!targets.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing new to analyze." });
      const analysis = { id: randomUUID(), startedAt: new Date().toISOString(), documentIds: targets.map((t) => t.id), result: null, coverage: null, suggestions: [] };
      await tx.update(exhibitions).set({ analysis }).where(eq(exhibitions.id, exhibition.id));
      return { exhibitionId: exhibition.id, analysisId: analysis.id };
    });
    await (await getBoss()).send(ANALYSIS_QUEUE, job, { retryLimit: 2 });
    return { id: job.analysisId };
  }),

  // Cancels the running analysis; the job notices before it writes anything.
  delete: consoleProcedure.input(consoleAnalysisGetInput).mutation(async ({ ctx, input }) => {
    await db.transaction(async (tx) => {
      const exhibition = await lockExhibition(tx, ctx.institutionId, input.code);
      if (!exhibition.analysis || exhibition.analysis.result !== null) throw new TRPCError({ code: "NOT_FOUND" });
      await tx.update(exhibitions).set({ analysis: { ...exhibition.analysis, result: "CANCELLED" } }).where(eq(exhibitions.id, exhibition.id));
    });
    return { ok: true };
  }),

  // The overview's processing state: the current analysis plus document and content counts.
  // `jobs` is the pg-boss job list (SPEC §9.5); not built yet.
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
