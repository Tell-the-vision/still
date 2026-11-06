import { expect, test } from "next/experimental/testmode/playwright";
import { extractedExhibition } from "./support/analysis";
import { consoleCall, e2eSql } from "./support/staff";

// SPEC §10.10 analysis.structure: a document goes to the Worker in chunks of at most 100 pages. The fake
// Worker answers each request with one item holding the pages it was sent, so a 101-page document comes
// back as two items: pages 1-100, then page 101.
test.use({ viewport: { width: 1440, height: 900 } });

test("a 101-page document is analysed in two chunks and every page comes back", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page, "Chunked catalogue text.", 101);
  const started = await consoleCall(page, "console.analysis.create", { code: exhibition.code });
  expect(started.status).toBe(200);

  await expect.poll(async () => {
    const [row] = await e2eSql<{ result: string | null }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]);
    return row.result;
  }, { timeout: 30_000 }).toBe("SUCCEEDED");

  const rows = await e2eSql<{ doc: { content: { type: string; content?: { text: string }[] }[] } }>(
    "SELECT doc FROM contents WHERE exhibition_id = $1 ORDER BY created_at, id", [exhibition.id]);
  const paragraphs = rows.map((r) => r.doc.content.filter((b) => b.type === "paragraph").map((b) => (b.content ?? []).map((t) => t.text).join("")));
  expect(paragraphs.map((p) => p.length)).toEqual([100, 1]);
  expect(paragraphs[0][0]).toBe("Chunked catalogue text. Page 1.");
  expect(paragraphs[1][0]).toBe("Chunked catalogue text. Page 101.");
});

// Gemini writes a chunk's text back out, so a long chunk is a long call: chunks are kept short (about 5,000 characters)
// and sent together. The fake Worker answers "TOGETHER 3" text only while three chunks of the analysis are in
// flight at once (see fake-analysis-worker.ts), so chunks sent one after another fail.
test("a long document is drafted from short chunks sent together, in page order", async ({ page }) => {
  // Three pages of about 3,000 characters: no two fit in one chunk, so each page is a chunk of its own.
  const filler = "Turner walked the shore at dawn and painted the light on the water. ".repeat(45);
  const pages = ["First", "Second", "Third"].map((name) => `${name} page. TOGETHER 3 ${filler}`.trim());
  const { exhibition } = await extractedExhibition(page, pages);

  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await e2eSql<{ result: string | null }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]))[0].result, { timeout: 30_000 }).toBe("SUCCEEDED");

  // One drafted artwork per chunk, listed in the console in the order of the pages.
  await page.goto(`/console/exhibitions/${exhibition.code}`);
  await expect(page.getByRole("button", { name: /page\. TOGETHER 3/ })).toHaveText([/^First page/, /^Second page/, /^Third page/]);
});
