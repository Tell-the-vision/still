import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 편집 제안 (받아들이면): what accepting each kind does to the document.

test.use({ viewport: { width: 1440, height: 900 } });

const SCRAP = [{ type: "scrap", attrs: { sentenceId: null } }];
const run = (text: string, marks?: unknown) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const paragraph = (id: string, ...content: unknown[]) => ({ type: "paragraph", attrs: { id }, content });
const suggestion = (id: string, kind: string, node: string, proposal: unknown) => ({
  id, kind, target: { node }, proposal, rationale: kind, status: "OPEN", decidedBy: null, decidedAt: null,
});
type Block = { type: string; attrs: { id: string; level?: number }; content?: { text: string; marks?: unknown[] }[] };
const read = async (id: string) => (await e2eSql<{ doc: { content: Block[] }; sources: Record<string, { start: number; end: number }> }>("SELECT doc, sources FROM contents WHERE id = $1", [id]))[0];
const texts = (blocks: Block[]) => blocks.map((b) => (b.content ?? []).map((r) => r.text).join(""));

test("accepting each kind changes the document as SPEC §9.4 says", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, {
    kind: "ARTWORK", status: "READY",
    doc: [
      paragraph("fix", run("A "), run("Secret Shw", SCRAP), run(" end")),
      paragraph("punct", run("one --- two --- "), run("three", SCRAP)),
      paragraph("level", run("Chapter")),
      paragraph("missing", run("Body")),
      paragraph("split", run("First part. Second part.")),
      paragraph("guide", run("Plain words and a key sentence here.")),
    ],
    sources: { split: { refs: ["d:s"], start: 100, end: 124 } },
  });
  const suggestions = [
    suggestion("a", "TEXT_EXTRACTION_FIX", "fix", { text: "A The Secret Shw end" }),
    suggestion("b", "PUNCTUATION_CONSISTENCY", "punct", { from: "---", to: "—" }),
    suggestion("c", "STRUCTURE_LEVEL", "level", { level: 2 }),
    suggestion("d", "MISSING_HEADING", "missing", { text: "Intro", level: 3 }),
    suggestion("e", "SPLIT_FOR_MOBILE", "split", { offsets: [12] }),
    suggestion("f", "GUIDE_SENTENCE_CANDIDATE", "guide", { sentence: "a key sentence" }),
    suggestion("g", "METADATA_GAP", "guide", {}),
  ];
  await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [item.id, JSON.stringify(suggestions)]);
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");

  const accept = async (id: string) => {
    const list = await consoleCall(page, "console.suggestion.list", { code: exhibition.code });
    const revision = list.json.result.data.find((s: { id: string }) => s.id === id).revision;
    const res = await consoleCall(page, "console.suggestion.update", { contentId: item.id, id, status: "ACCEPTED", revision });
    expect(res.json.error).toBeUndefined();
  };
  const before = (await read(item.id)).doc.content;
  await accept("g");
  expect((await read(item.id)).doc.content).toEqual(before);
  for (const id of ["a", "b", "c", "d", "e", "f"]) await accept(id);

  const { doc, sources } = await read(item.id);
  const byId = (id: string) => doc.content.find((b) => b.attrs.id === id)!;
  expect(byId("fix").content).toEqual([run("A The "), run("Secret Shw", SCRAP), run(" end")]);
  expect(byId("punct").content).toEqual([run("one — two — "), run("three", SCRAP)]);
  expect(byId("level")).toMatchObject({ type: "heading", attrs: { level: 2 } });
  const missing = doc.content.findIndex((b) => b.attrs.id === "missing");
  expect(doc.content[missing - 1]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  expect(texts(doc.content)[missing - 1]).toBe("Intro");
  const split = doc.content.findIndex((b) => b.attrs.id === "split");
  expect(texts(doc.content).slice(split, split + 2)).toEqual(["First part. ", "Second part."]);
  expect(doc.content[split + 1].attrs.id).not.toBe("split");
  expect(sources.split).toMatchObject({ start: 100, end: 112 });
  expect(sources[doc.content[split + 1].attrs.id]).toMatchObject({ start: 112, end: 124 });
  expect(byId("guide").content).toEqual([run("Plain words and "), run("a key sentence", SCRAP), run(" here.")]);
  expect(new Set(doc.content.map((b) => b.attrs.id)).size).toBe(doc.content.length);
});

test("accepting a split on the review screen shows the paragraphs in the editor", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, {
    kind: "ARTWORK", status: "NEEDS_REVIEW",
    doc: [{ type: "heading", attrs: { id: "h1", level: 2 }, content: [run("Splitting piece")] }, paragraph("p1", run("Alpha sentence. Omega sentence."))],
  });
  await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [item.id, JSON.stringify([suggestion("s", "SPLIT_FOR_MOBILE", "p1", { offsets: [16] })])]);
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");
  await page.locator(".item", { hasText: "Splitting piece" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator(".ProseMirror p")).toHaveText(["Alpha sentence. ", "Omega sentence."]);
});
