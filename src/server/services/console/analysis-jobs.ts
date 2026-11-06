import { suggestInput, suggestOutput } from "@still/shared/analysis-suggest";
import { structureInput, structureOutput, type StructureOutput } from "@still/shared/analysis-structure";
import { signWorkerRequest } from "@still/shared/analysis-worker-signature";
import { and, eq, inArray, sql } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { db } from "../../db/client";
import { contents, documents, exhibitions, images } from "../../db/schema";
import { databaseUrl } from "../../db/url";
import type { StillBlock, StillDoc } from "@still/shared/still-doc";
import { alignStructure, type AlignedContent } from "./align";
import { presignPrivateGet } from "../../media/r2";
import { readManifest } from "./manifests";
import { runStorageDelete, STORAGE_DELETE_OPTIONS, STORAGE_DELETE_QUEUE, type StorageDelete } from "./storage-jobs";

// SPEC §9.4 구조화, §10.10 Worker 호출. One queue runs a whole analysis; SPEC splits it into structure and
// finalize jobs, which this simplification folds into one handler.
export const ANALYSIS_QUEUE = "analysis.run";
export const VERIFY_QUEUE = "document.verify";
const RETRY_LIMIT = 2;
type JobData = { exhibitionId: string; analysisId: string };
// `finalizedAt` marks that the contents are committed (only suggestions and the result remain), so a retry never inserts them twice.
type Analysis = { id: string; documentIds: string[]; result: string | null; coverage: Coverage | null; finalizedAt?: string; failures?: DocumentFailure[] };
// A document the analysis could not read; it stays unanalyzed, so the next analysis tries it again.
type DocumentFailure = { documentId: string; error: string };
type Coverage = { total: number; uncovered: number; refs: string[] };

// One boss per process, shared by the tRPC routes (send) and instrumentation (work).
const globalForBoss = globalThis as unknown as { stillBoss?: Promise<PgBoss> };
export function getBoss(): Promise<PgBoss> {
  globalForBoss.stillBoss ??= (async () => {
    const boss = new PgBoss(databaseUrl());
    boss.on("error", (e) => console.error("pg-boss", e));
    await boss.start();
    await boss.createQueue(ANALYSIS_QUEUE, ANALYSIS_JOB_OPTIONS);
    await boss.createQueue(STORAGE_DELETE_QUEUE, STORAGE_DELETE_OPTIONS);
    await boss.createQueue(VERIFY_QUEUE, { retryLimit: RETRY_LIMIT });
    return boss;
  })().catch((e) => {
    globalForBoss.stillBoss = undefined; // the next call tries again instead of failing for the process's life
    throw e;
  });
  return globalForBoss.stillBoss;
}

// SPEC §10.10 analysis jobs: 2 retries with exponential backoff.
export const ANALYSIS_JOB_OPTIONS = { retryLimit: RETRY_LIMIT, retryDelay: 30, retryBackoff: true };

const ANALYSIS_CONCURRENCY = 4;

export async function startWorkers() {
  const boss = await getBoss();
  await boss.work<StorageDelete>(STORAGE_DELETE_QUEUE, async ([job]) => runStorageDelete(job.data));
  // pg-boss runs one job at a time per worker by default; one long analysis (minutes of Gemini) would then
  // hold every other exhibition's analysis behind it on this server.
  await boss.work<JobData>(ANALYSIS_QUEUE, { localConcurrency: ANALYSIS_CONCURRENCY }, async ([job]) => {
    try {
      await runAnalysis(job.data);
    } catch (e) {
      // The last attempt gives up for good; earlier ones are retried by pg-boss.
      if (job.retryCount >= RETRY_LIMIT) await settle(job.data, "FAILED");
      throw e;
    }
  });
  await boss.work<{ documentId: string }>(VERIFY_QUEUE, async ([job]) => verifyDocument(job.data.documentId));
}

// SPEC §10.7 검증, §10.10 document.verify: the Worker re-reads each asset's source range from the original
// and compares hashes. A MISMATCH blocks publication (§9.7).
async function verifyDocument(documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc?.manifestObjectKey) return;
  const manifest = await readManifest(doc.manifestObjectKey);
  const ranges = manifest.assets.flatMap((a) => (a.sourceRange ? [{ assetId: a.id, ...a.sourceRange, sha256: a.sha256 }] : []));
  if (!ranges.length) return;
  let { url } = await presignPrivateGet(doc.objectKey);
  if (url.startsWith("/")) url = `${process.env.STILL_ORIGIN}${url}`; // dry-run URLs are local paths
  const body = JSON.stringify({ url, ranges });
  const headers = await signWorkerRequest(process.env.ANALYSIS_WORKER_SECRET ?? "", body, Math.floor(Date.now() / 1000));
  const res = await fetch(`${process.env.ANALYSIS_WORKER_URL}/verify`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  if (!res.ok) throw new Error(`Worker answered HTTP ${res.status}`);
  const { results } = (await res.json()) as { results: { assetId: string; ok: boolean }[] };
  for (const { assetId, ok } of results) {
    await db.update(images).set({ verification: ok ? "VERIFIED" : "MISMATCH" }).where(and(eq(images.documentId, documentId), eq(images.manifestAssetId, assetId)));
  }
}

// SPEC §10.10 실시간 알림: tells `console.analysis.watch` listeners. Inside a transaction it is delivered on commit.
type Executor = Pick<typeof db, "execute">;
export const notify = (exec: Executor, analysisId: string, state: "active" | "completed" | "failed" | "cancelled", error?: string) =>
  exec.execute(sql`select pg_notify(${`analysis_${analysisId}`}, ${JSON.stringify({ queue: ANALYSIS_QUEUE, key: "run", state, error })})`);

const analysisOf = async (exhibitionId: string) =>
  (await db.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)))[0]?.analysis as Analysis | null;
const isRunning = (analysis: Analysis | null, id: string) => analysis?.id === id && analysis.result === null;

async function settle({ exhibitionId, analysisId }: JobData, result: "FAILED", failures?: DocumentFailure[]) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (isRunning(row?.analysis as Analysis | null, analysisId)) await tx.update(exhibitions).set({ analysis: { ...(row.analysis as Analysis), result, ...(failures && { failures }) } }).where(eq(exhibitions.id, exhibitionId));
    if (isRunning(row?.analysis as Analysis | null, analysisId)) await notify(tx, analysisId, "failed", "Analysis failed.");
  });
}

// SPEC §10.10 analysis.structure: a document goes to the Worker in chunks of at most 100 pages or about
// 100k input tokens. Tokens are estimated from characters (3 per token, cautious for Korean text).
const CHUNK_PAGES = 100;
// SPEC's ceiling is 100k input tokens, but the model copies the text back out, and its output is capped
// lower (65,536 tokens for gemini-2.5-flash); chunks stay well under that.
const CHUNK_TOKENS = 30_000;
export function chunkPages<T extends { text: string }>(pages: T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let tokens = 0;
  for (const page of pages) {
    const pageTokens = Math.ceil(page.text.length / 3);
    if (current.length && (current.length >= CHUNK_PAGES || tokens + pageTokens > CHUNK_TOKENS)) {
      chunks.push(current);
      current = [];
      tokens = 0;
    }
    current.push(page);
    tokens += pageTokens;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// The chunk answers as one: items in order, outline item indexes shifted past the earlier chunks' items.
function mergeOutputs(outputs: StructureOutput[]): StructureOutput {
  const merged: StructureOutput = { items: [], outline: [], variants: [], usage: { model: outputs[0]?.usage.model ?? "", inputTokens: 0, outputTokens: 0 } };
  for (const output of outputs) {
    const offset = merged.items.length;
    merged.items.push(...output.items);
    merged.outline.push(...output.outline.map((section) => ({ ...section, items: section.items.map((i) => i + offset) })));
    merged.variants.push(...output.variants);
    merged.usage.inputTokens += output.usage.inputTokens;
    merged.usage.outputTokens += output.usage.outputTokens;
  }
  return merged;
}

async function structureChunk(analysisId: string, chunk: number, document: { mediaType: string; category: string | null }, pages: { page: number; text: string }[], images: { id: string; page: number; url: null }[]) {
  const body = JSON.stringify(structureInput.parse({ analysisId, chunk, document, pages, images }));
  const headers = await signWorkerRequest(process.env.ANALYSIS_WORKER_SECRET ?? "", body, Math.floor(Date.now() / 1000));
  const res = await fetch(`${process.env.ANALYSIS_WORKER_URL}/structure/text`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  if (!res.ok) throw new Error(`Worker answered HTTP ${res.status} for chunk ${chunk}: ${(await res.text()).slice(0, 200)}`);
  return structureOutput.parse(await res.json());
}

type Manifest = Awaited<ReturnType<typeof readManifest>>;
type OutputBlock = StructureOutput["items"][number]["blocks"][number];

// The text of each page in reading order, with each picture of the document (not page renders) as an "[image a01]"
// line where it sits: before the first line below its top edge, or after the page's lines when there are no positions.
function linesOf(manifest: Manifest) {
  const pictures = manifest.assets.filter((a) => a.kind !== "PAGE_IMAGE" && !a.variantOf && a.placements.length > 0);
  const pageNumbers = [...new Set([...manifest.segments.map((s) => s.page), ...pictures.map((a) => a.placements[0].page)])].sort((a, b) => a - b);
  const byPage = new Map<number, string[]>();
  for (const page of pageNumbers) {
    const lines = manifest.segments.filter((s) => s.page === page).map((s) => ({ top: s.bbox?.[1] ?? null, text: s.text }));
    for (const picture of pictures.filter((a) => a.placements[0].page === page)) {
      const top = picture.placements[0].bbox[1];
      const at = lines.findIndex((line) => line.top !== null && line.top > top);
      lines.splice(at < 0 ? lines.length : at, 0, { top, text: `[image ${picture.id}]` });
    }
    byPage.set(page, lines.map((line) => line.text));
  }
  return { byPage, pictures };
}

// Gemini places a picture as a stillImage block at its "[image a01]" line. A marker copied as text instead becomes that
// block, one left inside a paragraph is taken out (the picture follows the paragraph), and each picture is placed once.
function withPictures(output: StructureOutput): StructureOutput {
  const placed = new Set<string>();
  const picture = (imageId: string): OutputBlock[] => {
    if (placed.has(imageId)) return [];
    placed.add(imageId);
    return [{ type: "stillImage", imageId, display: "INLINE", caption: null }];
  };
  const items = output.items.map((item) => ({
    ...item,
    blocks: item.blocks.flatMap((block): OutputBlock[] => {
      if (block.type === "stillImage") return picture(block.imageId).length ? [block] : [];
      if (block.type !== "paragraph" && block.type !== "quote") return [block];
      const ids = [...block.text.matchAll(/\[image (a\d{2,})\]/g)].map((m) => m[1]);
      if (!ids.length) return [block];
      const text = block.text.replace(/\s*\[image a\d{2,}\]\s*/g, " ").trim();
      return [...(text ? [{ ...block, text }] : []), ...ids.flatMap(picture)];
    }),
  }));
  return { ...output, items };
}

async function structure(analysisId: string, document: { mediaType: string; category: string | null }, manifest: Manifest) {
  const { byPage, pictures } = linesOf(manifest);
  // A page bigger than a chunk (a long TXT is one page) is cut at segment boundaries into parts.
  const pages = [...byPage].flatMap(([page, texts]) => {
    const parts: { page: number; text: string }[] = [];
    for (const text of texts) {
      const last = parts.at(-1);
      if (last && Math.ceil((last.text.length + text.length) / 3) <= CHUNK_TOKENS) last.text += `\n${text}`;
      else parts.push({ page, text });
    }
    return parts;
  });
  const outputs: StructureOutput[] = [];
  for (const [chunk, chunkPagesList] of chunkPages(pages).entries()) {
    // Each chunk is offered the pictures on its pages, to place by asset id.
    const onPages = new Set(chunkPagesList.map((p) => p.page));
    const offered = pictures.filter((a) => onPages.has(a.placements[0].page)).map((a) => ({ id: a.id, page: a.placements[0].page, url: null }));
    outputs.push(await structureChunk(analysisId, chunk, document, chunkPagesList, offered));
  }
  return withPictures(mergeOutputs(outputs));
}

async function runAnalysis({ exhibitionId, analysisId }: JobData) {
  const analysis = await analysisOf(exhibitionId);
  if (!isRunning(analysis, analysisId)) return; // cancelled (or replaced) before it ran
  if (analysis!.finalizedAt) return finishAnalysis(exhibitionId, analysisId); // a retry after the contents were committed

  await notify(db, analysisId, "active");
  const docs = await db.select().from(documents).where(and(eq(documents.exhibitionId, exhibitionId), inArray(documents.id, analysis!.documentIds))).orderBy(documents.createdAt, documents.id);
  const coverage: Coverage = { total: 0, uncovered: 0, refs: [] };
  const aligned: { documentId: string; contents: AlignedContent[] }[] = [];
  const failures: DocumentFailure[] = [];
  let lastError: unknown = null;
  for (const doc of docs) {
    try {
      const manifest = await readManifest(doc.manifestObjectKey!);
      // A scan without a text layer needs OCR (SPEC §9.4); until then it is reported, not passed as analyzed.
      if (!manifest.segments.length) { failures.push({ documentId: doc.id, error: "NO_TEXT_LAYER" }); continue; }
      const output = await structure(analysisId, { mediaType: doc.mediaType, category: doc.category }, manifest);
      const rows = await db.select({ id: images.id, assetId: images.manifestAssetId }).from(images).where(eq(images.documentId, doc.id));
      const result = alignStructure({ output, documentId: doc.id, manifest, images: Object.fromEntries(rows.map((r) => [r.assetId!, r.id])) });
      aligned.push({ documentId: doc.id, contents: result.contents });
      coverage.total += result.coverage.total;
      coverage.uncovered += result.coverage.uncovered;
      coverage.refs.push(...result.coverage.refs);
    } catch (e) {
      lastError = e;
      failures.push({ documentId: doc.id, error: e instanceof Error ? e.message.slice(0, 200) : "Analysis failed." });
    }
  }
  if (!aligned.length) {
    // Nothing could be read. Only text-less files: retrying cannot help, so the analysis fails now.
    if (failures.every((f) => f.error === "NO_TEXT_LAYER")) return settle({ exhibitionId, analysisId }, "FAILED", failures);
    throw lastError ?? new Error("No document could be analyzed.");
  }

  const created: { id: string; kind: string; doc: StillDoc }[] = [];
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (!isRunning(row.analysis as Analysis, analysisId)) return; // cancelled meanwhile
    if ((row.analysis as Analysis).finalizedAt) return; // another attempt already wrote the contents
    // Items keep source order: the console lists by created_at, which one transaction would make equal.
    const start = Date.now();
    let position = 0;
    for (const { documentId, contents: items } of aligned) {
      for (const c of items) {
        const createdAt = new Date(start + position++);
        const [{ id }] = await tx.insert(contents).values({ exhibitionId, kind: c.kind, status: c.status, doc: c.doc, sources: c.sources, fields: c.fields, suggestions: c.suggestions, createdAt }).returning({ id: contents.id });
        created.push({ id, kind: c.kind, doc: c.doc });
      }
      await tx.update(documents).set({ analyzedAt: new Date() }).where(eq(documents.id, documentId));
    }
    await tx.update(exhibitions).set({ analysis: { ...(row.analysis as Analysis), coverage, failures, finalizedAt: new Date().toISOString() } }).where(eq(exhibitions.id, exhibitionId));
  });
  // SPEC §10.10: analysis.suggest runs after the contents are committed, and only its end sets SUCCEEDED,
  // so the console (which stops watching at the result) sees the items with their suggestions.
  // Suggestions are optional: a failed /suggest still ends the analysis as SUCCEEDED.
  if (created.length) await suggestEdits(exhibitionId, analysisId, created).catch((e) => console.error("analysis.suggest", e));
  await finishAnalysis(exhibitionId, analysisId);
}

async function finishAnalysis(exhibitionId: string, analysisId: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (!isRunning(row.analysis as Analysis, analysisId)) return; // cancelled meanwhile
    await tx.update(exhibitions).set({ analysis: { ...(row.analysis as Analysis), result: "SUCCEEDED" } }).where(eq(exhibitions.id, exhibitionId));
    await notify(tx, analysisId, "completed");
  });
}

// Suggestions a person must look at before the item is ready (SPEC §9.4 "확인 필요").
const NEEDS_CHECK_KINDS: string[] = ["TEXT_MISMATCH", "LABEL_GENERATED", "IMAGE_NOT_ANALYZED", "SOURCE_CONFLICT"];

const textOf = (block: StillBlock) => ((block as { content?: { text?: string }[] }).content ?? []).map((n) => n.text ?? "").join("");

// SPEC §9.4 제안, §10.10 analysis.suggest: runs after the analysis has committed. Suggestions are optional,
// so any failure leaves the finished analysis as it is. APPROVED items only gain the suggestion.
async function suggestEdits(exhibitionId: string, analysisId: string, created: { id: string; kind: string; doc: StillDoc }[]) {
  if (!created.length) return;
  const items = created.map((c) => ({
    contentId: c.id,
    kind: c.kind,
    blocks: c.doc.content.filter((b) => b.type === "paragraph" || b.type === "heading").map((b) => ({ id: b.attrs.id, type: b.type, text: textOf(b) })),
  }));
  const body = JSON.stringify(suggestInput.parse({ analysisId, items }));
  const headers = await signWorkerRequest(process.env.ANALYSIS_WORKER_SECRET ?? "", body, Math.floor(Date.now() / 1000));
  const res = await fetch(`${process.env.ANALYSIS_WORKER_URL}/suggest`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  if (!res.ok) throw new Error(`Worker answered HTTP ${res.status}`);
  const { suggestions } = suggestOutput.parse(await res.json());

  await db.transaction(async (tx) => {
    const [current] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    if (!isRunning(current?.analysis as Analysis | null, analysisId)) return; // cancelled meanwhile
    // Ids are unique within a list: "w" + position among the new ones (aligned suggestions use "g").
    const stored = (list: typeof suggestions, taken: number) =>
      list.map(({ kind, target, proposal, rationale }, i) => ({ id: `w${taken + i + 1}`, kind, target, proposal, rationale, status: "OPEN", decidedBy: null, decidedAt: null }));
    for (const id of created.map((c) => c.id)) {
      const mine = suggestions.filter((s) => s.contentId === id);
      if (!mine.length) continue;
      const [row] = await tx.select({ suggestions: contents.suggestions, status: contents.status }).from(contents).where(eq(contents.id, id)).for("update");
      if (!row) continue; // deleted meanwhile
      const needsCheck = row.status === "READY" && mine.some((s) => NEEDS_CHECK_KINDS.includes(s.kind));
      await tx.update(contents).set({ suggestions: [...(row.suggestions as unknown[]), ...stored(mine, 0)], ...(needsCheck && { status: "NEEDS_REVIEW" as const }) }).where(eq(contents.id, id));
    }
    const wide = suggestions.filter((s) => s.contentId === null);
    if (!wide.length) return;
    const [ex] = await tx.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for("update");
    const analysis = ex.analysis as Analysis & { suggestions?: unknown[] };
    await tx.update(exhibitions).set({ analysis: { ...analysis, suggestions: [...(analysis.suggestions ?? []), ...stored(wide, analysis.suggestions?.length ?? 0)] } }).where(eq(exhibitions.id, exhibitionId));
  });
}
