import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { extractedDocument, extractedExhibition } from "./support/analysis";
import { consoleCall, e2eSql } from "./support/staff";

type AnalysisRow = { result: string | null; failures: { documentId: string; error: string }[] | null };
const analysisOf = async (exhibitionId: string) =>
  (await e2eSql<AnalysisRow>("SELECT analysis->>'result' AS result, analysis->'failures' AS failures FROM exhibitions WHERE id = $1", [exhibitionId]))[0];
const analyzedAt = async (documentId: string) => (await e2eSql<{ analyzed_at: Date | null }>("SELECT analyzed_at FROM documents WHERE id = $1", [documentId]))[0].analyzed_at;

// An emoji (an astral character) before a block used to shift the source ranges into NaN, and the review
// list of the whole exhibition failed to load.
test("a document with an emoji is analysed and its items list with source ranges", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page, "Opening line 🎨 then words.", 2);
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await analysisOf(exhibition.id)).result, { timeout: 30_000 }).toBe("SUCCEEDED");
  const list = await consoleCall(page, "console.content.list", { code: exhibition.code });
  expect(list.status).toBe(200);
  const sources = Object.values(list.json.result.data[0].sources as Record<string, { start: number; end: number }>);
  expect(sources.length).toBeGreaterThan(0);
  for (const s of sources) expect(Number.isInteger(s.start) && Number.isInteger(s.end)).toBe(true);
});

// SPEC §9.4: a PDF without a text layer is not a silent success (it needs OCR); it stays unanalysed.
test("a document with no text layer fails the analysis as NO_TEXT_LAYER and stays unanalysed", async ({ page }) => {
  const { exhibition, documentId } = await extractedExhibition(page, "", 0);
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await analysisOf(exhibition.id)).result, { timeout: 30_000 }).toBe("FAILED");
  expect((await analysisOf(exhibition.id)).failures).toEqual([{ documentId, error: "NO_TEXT_LAYER" }]);
  expect(await analyzedAt(documentId)).toBeNull();
});

// SPEC §10.10: a file failure is not a job failure. The readable document is analysed; the other is reported
// and stays unanalysed, so the next analysis tries it again.
test("one document failing at the Worker does not fail the others", async ({ page }) => {
  const { exhibition, account, documentId: good } = await extractedExhibition(page, "Readable catalogue text.");
  const bad = await extractedDocument(page, account, exhibition, "FAIL_STRUCTURE text.");
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await analysisOf(exhibition.id)).result, { timeout: 30_000 }).toBe("SUCCEEDED");
  expect((await analysisOf(exhibition.id)).failures?.map((f) => f.documentId)).toEqual([bad]);
  expect(await analyzedAt(good)).not.toBeNull();
  expect(await analyzedAt(bad)).toBeNull();
});

// An analysis whose job is gone (expired, or killed with the process) must not block a new one forever.
test("a running analysis with no live job does not block starting a new one", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page, "Stranded catalogue text.");
  await e2eSql("UPDATE exhibitions SET analysis = $2 WHERE id = $1", [exhibition.id, JSON.stringify({ id: randomUUID(), startedAt: new Date().toISOString(), documentIds: [], result: null, coverage: null, suggestions: [] })]);
  const res = await consoleCall(page, "console.analysis.create", { code: exhibition.code });
  expect(res.status).toBe(200);
  await expect.poll(async () => (await analysisOf(exhibition.id)).result, { timeout: 30_000 }).toBe("SUCCEEDED");
});
