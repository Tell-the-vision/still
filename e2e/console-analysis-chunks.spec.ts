import { expect, test } from "next/experimental/testmode/playwright";
import { extractedExhibition } from "./support/analysis";
import { consoleCall, e2eSql } from "./support/staff";

// SPEC §10.10 analysis.structure: a document goes to the Worker in chunks of at most 100 pages. The fake
// Worker answers each request with one item holding the pages it was sent, so a 101-page document comes
// back as two items: pages 1-100, then page 101.
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
