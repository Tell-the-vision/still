import { and, eq, inArray, sql } from "drizzle-orm";
import type { db } from "../../db/client";
import { contents, documents, exhibitions } from "../../db/schema";
import type { FinalizeResult } from "./finalize";

// SPEC §10.8 쓰기 경로 (analysis.finalize): the database half of finalizeStructure, inside the caller's transaction.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Appends the finalized contents (existing ones are never touched), marks the covered documents analyzed and
// writes coverage and outline into exhibitions.analysis next to its other keys.
//
// Idempotent per analysis: the analysis summary gets `finalizedAt`, and a second call for an analysis that has
// it writes nothing and returns { written: false }, so a retried job does not duplicate contents.
export async function writeFinalizedContents(
  tx: Tx,
  input: { exhibitionId: string; analysisId: string; documentIds: string[]; result: FinalizeResult },
): Promise<{ written: boolean }> {
  const { exhibitionId, analysisId, documentIds, result } = input;

  const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
  const analysis = row?.analysis as { id?: string; finalizedAt?: string } | null;
  if (analysis?.id !== analysisId) throw new Error(`analysis ${analysisId} is not the current analysis of exhibition ${exhibitionId}`);
  if (analysis.finalizedAt) return { written: false };

  if (result.contents.length) {
    await tx.insert(contents).values(
      result.contents.map((c) => ({ exhibitionId, kind: c.kind, status: c.status, blocks: c.blocks, fields: c.fields, suggestions: c.suggestions })),
    );
  }
  if (documentIds.length) {
    await tx
      .update(documents)
      .set({ analyzedAt: sql`now()` })
      .where(and(eq(documents.exhibitionId, exhibitionId), inArray(documents.id, documentIds)));
  }
  const finished = JSON.stringify({ coverage: result.coverage, outline: result.outline });
  await tx
    .update(exhibitions)
    .set({ analysis: sql`${exhibitions.analysis} || ${finished}::jsonb || jsonb_build_object('finalizedAt', now())` })
    .where(eq(exhibitions.id, exhibitionId));
  return { written: true };
}
