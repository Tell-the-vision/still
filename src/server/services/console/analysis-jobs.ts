import { structureInput, structureOutput } from "@still/shared/analysis-structure";
import { signWorkerRequest } from "@still/shared/analysis-worker-signature";
import { and, eq, inArray } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { db } from "../../db/client";
import { contents, documents, exhibitions, images } from "../../db/schema";
import { databaseUrl } from "../../db/url";
import { alignStructure, type AlignedContent } from "./align";
import { readManifest } from "./manifests";

// SPEC §9.4 구조화, §10.10 Worker 호출. One queue runs a whole analysis; SPEC splits it into structure and
// finalize jobs, which this simplification folds into one handler.
export const ANALYSIS_QUEUE = "analysis.run";
const RETRY_LIMIT = 2;
type JobData = { exhibitionId: string; analysisId: string };
type Analysis = { id: string; documentIds: string[]; result: string | null; coverage: Coverage | null };
type Coverage = { total: number; uncovered: number; refs: string[] };

// One boss per process, shared by the tRPC routes (send) and instrumentation (work).
const globalForBoss = globalThis as unknown as { stillBoss?: Promise<PgBoss> };
export function getBoss(): Promise<PgBoss> {
  globalForBoss.stillBoss ??= (async () => {
    const boss = new PgBoss(databaseUrl());
    boss.on("error", (e) => console.error("pg-boss", e));
    await boss.start();
    await boss.createQueue(ANALYSIS_QUEUE, { retryLimit: RETRY_LIMIT });
    return boss;
  })();
  return globalForBoss.stillBoss;
}

export async function startWorkers() {
  const boss = await getBoss();
  await boss.work<JobData>(ANALYSIS_QUEUE, async ([job]) => {
    try {
      await runAnalysis(job.data);
    } catch (e) {
      // The last attempt gives up for good; earlier ones are retried by pg-boss.
      if (job.retryCount >= RETRY_LIMIT) await settle(job.data, "FAILED");
      throw e;
    }
  });
}

const analysisOf = async (exhibitionId: string) =>
  (await db.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)))[0]?.analysis as Analysis | null;
const isRunning = (analysis: Analysis | null, id: string) => analysis?.id === id && analysis.result === null;

async function settle({ exhibitionId, analysisId }: JobData, result: "FAILED") {
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (isRunning(row?.analysis as Analysis | null, analysisId)) await tx.update(exhibitions).set({ analysis: { ...(row.analysis as Analysis), result } }).where(eq(exhibitions.id, exhibitionId));
  });
}

async function structure(analysisId: string, document: { mediaType: string; category: string | null }, manifest: Awaited<ReturnType<typeof readManifest>>) {
  const byPage = new Map<number, string[]>();
  for (const s of manifest.segments) byPage.set(s.page, [...(byPage.get(s.page) ?? []), s.text]);
  const pages = [...byPage].map(([page, texts]) => ({ page, text: texts.join("\n") }));
  const body = JSON.stringify(structureInput.parse({ analysisId, chunk: 0, document, pages, images: [] }));
  const headers = await signWorkerRequest(process.env.ANALYSIS_WORKER_SECRET ?? "", body, Math.floor(Date.now() / 1000));
  const res = await fetch(`${process.env.ANALYSIS_WORKER_URL}/structure/text`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  if (!res.ok) throw new Error(`Worker answered HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return structureOutput.parse(await res.json());
}

async function runAnalysis({ exhibitionId, analysisId }: JobData) {
  const analysis = await analysisOf(exhibitionId);
  if (!isRunning(analysis, analysisId)) return; // cancelled (or replaced) before it ran

  const docs = await db.select().from(documents).where(and(eq(documents.exhibitionId, exhibitionId), inArray(documents.id, analysis!.documentIds)));
  const coverage: Coverage = { total: 0, uncovered: 0, refs: [] };
  const aligned: { documentId: string; contents: AlignedContent[] }[] = [];
  for (const doc of docs) {
    const manifest = await readManifest(doc.manifestObjectKey!);
    const output = await structure(analysisId, { mediaType: doc.mediaType, category: doc.category }, manifest);
    const rows = await db.select({ id: images.id, assetId: images.manifestAssetId }).from(images).where(eq(images.documentId, doc.id));
    const result = alignStructure({ output, documentId: doc.id, manifest, images: Object.fromEntries(rows.map((r) => [r.assetId!, r.id])) });
    aligned.push({ documentId: doc.id, contents: result.contents });
    coverage.total += result.coverage.total;
    coverage.uncovered += result.coverage.uncovered;
    coverage.refs.push(...result.coverage.refs);
  }

  await db.transaction(async (tx) => {
    const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (!isRunning(row.analysis as Analysis, analysisId)) return; // cancelled meanwhile
    for (const { documentId, contents: items } of aligned) {
      for (const c of items) await tx.insert(contents).values({ exhibitionId, kind: c.kind, status: c.status, doc: c.doc, sources: c.sources, fields: c.fields, suggestions: c.suggestions });
      await tx.update(documents).set({ analyzedAt: new Date() }).where(eq(documents.id, documentId));
    }
    await tx.update(exhibitions).set({ analysis: { ...(row.analysis as Analysis), coverage, result: "SUCCEEDED" } }).where(eq(exhibitions.id, exhibitionId));
  });
}
