import { expect, test } from "next/experimental/testmode/playwright";
import { editorDoc, scrapRuns, type StillDoc } from "../shared/src/still-doc";
import { applySuggestion } from "../src/server/services/console/suggestion-apply";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

const text = (t: string, sentenceId?: string | null) =>
  sentenceId === undefined ? { type: "text", text: t } : { type: "text", text: t, marks: [{ type: "scrap", attrs: { sentenceId } }] };
const para = (id: string, ...content: object[]) => ({ type: "paragraph", attrs: { id }, content });

// SPEC §9.4: the Tiptap editor's own defaults (orderedList start/type, hard breaks) are brought to the STILL schema.
test("an editor document with orderedList defaults and a hard break is accepted and stored clean", () => {
  const parsed = editorDoc.parse({ type: "doc", content: [
    { type: "orderedList", attrs: { id: "l1", start: 1, type: null }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("One")] }] }] },
    para("p1", text("Line"), { type: "hardBreak" }, text("break")),
  ] }) as StillDoc;
  expect(parsed.content[0]).toMatchObject({ type: "orderedList", attrs: { id: "l1" } });
  expect((parsed.content[0] as { attrs: object }).attrs).toEqual({ id: "l1" });
  expect((parsed.content[1] as { content: { text: string }[] }).content.map((n) => n.text).join("")).toBe("Line break");
});

// SPEC §9.4 Scrap 문장: a run never crosses from one list item into the next.
test("each marked list item is its own sentence", () => {
  const doc = { type: "doc", content: [{ type: "bulletList", attrs: { id: "l1" }, content: ["A.", "B.", "C."].map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [text(t, null)] }] })) }] } as StillDoc;
  expect(scrapRuns(doc).map((r) => r.text)).toEqual(["A.", "B.", "C."]);
});

// SPEC §9.7: a text fix inside a scrap sentence keeps the sentence and its id.
test("a text fix inside a marked sentence keeps the mark and the sentenceId", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const doc = { type: "doc", content: [para("p1", text("Intro. "), text("Te Secret Show is quiet.", id))] } as StillDoc;
  const { doc: fixed } = applySuggestion(doc, {}, { id: "g1", kind: "TEXT_EXTRACTION_FIX", target: { node: "p1" }, proposal: { text: "Intro. The Secret Show is quiet." }, status: "OPEN", decidedBy: null, decidedAt: null } as never);
  expect((fixed.content[0] as { content: object[] }).content).toEqual([text("Intro. "), text("The Secret Show is quiet.", id)]);
});

test("punctuation unification next to an emoji keeps every other character", () => {
  const doc = { type: "doc", content: [para("p1", text("😀 a---b and c---d"))] } as StillDoc;
  const { doc: fixed } = applySuggestion(doc, {}, { id: "g1", kind: "PUNCTUATION_CONSISTENCY", target: { node: "p1" }, proposal: { from: "---", to: "—" }, status: "OPEN", decidedBy: null, decidedAt: null } as never);
  expect((fixed.content[0] as { content: { text: string }[] }).content.map((n) => n.text).join("")).toBe("😀 a—b and c—d");
});

async function seeded(page: import("@playwright/test").Page, doc: object[], status = "READY", suggestions: object[] = []) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, { kind: "ARTWORK", status, doc });
  if (suggestions.length) await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [item.id, JSON.stringify(suggestions)]);
  await signInConsole(page, account);
  const [row] = await e2eSql<{ revision: string }>("SELECT revision FROM contents WHERE id = $1", [item.id]);
  return { item, revision: row.revision };
}
const storedDoc = async (id: string) => (await e2eSql<{ doc: StillDoc }>("SELECT doc FROM contents WHERE id = $1", [id]))[0].doc;

test("content.update takes an editor-shaped document", async ({ page }) => {
  const { item, revision } = await seeded(page, [para("p1", text("Old"))]);
  const res = await consoleCall(page, "console.content.update", { id: item.id, revision, doc: { type: "doc", content: [
    { type: "orderedList", attrs: { id: "l1", start: 1, type: null }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("One"), { type: "hardBreak" }, text("two")] }] }] },
  ] } });
  expect(res.status).toBe(200);
  expect((await storedDoc(item.id)).content[0]).toMatchObject({ type: "orderedList", attrs: { id: "l1" } });
});

// SPEC §10.9: sentence ids survive edits, including a save from a tab opened before the last publication.
test("a stale save keeps the published sentenceId, and a split gives it to the first half only", async ({ page }) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const { item, revision } = await seeded(page, [para("p1", text("Kept sentence.", id))]);
  const stale = await consoleCall(page, "console.content.update", { id: item.id, revision, doc: { type: "doc", content: [para("p1", text("Kept sentence.", null))] } });
  expect(stale.status).toBe(200);
  expect(scrapRuns(await storedDoc(item.id)).map((r) => r.sentenceId)).toEqual([id]);

  const [row] = await e2eSql<{ revision: string }>("SELECT revision FROM contents WHERE id = $1", [item.id]);
  const split = await consoleCall(page, "console.content.update", { id: item.id, revision: row.revision, doc: { type: "doc", content: [para("p1", text("Kept ", id)), para("p2", text("sentence.", id))] } });
  expect(split.status).toBe(200);
  expect(scrapRuns(await storedDoc(item.id)).map((r) => r.sentenceId)).toEqual([id, null]);
});

test("a decided suggestion cannot be decided again, and a rejected item takes no suggestion", async ({ page }) => {
  const open = { id: "g1", kind: "TEXT_MISMATCH", target: { node: "p1" }, status: "OPEN", decidedBy: null, decidedAt: null };
  const { item, revision } = await seeded(page, [para("p1", text("Body"))], "NEEDS_REVIEW", [open]);
  expect((await consoleCall(page, "console.suggestion.update", { contentId: item.id, id: "g1", status: "DISMISSED", revision })).status).toBe(200);
  const [row] = await e2eSql<{ revision: string }>("SELECT revision FROM contents WHERE id = $1", [item.id]);
  expect((await consoleCall(page, "console.suggestion.update", { contentId: item.id, id: "g1", status: "ACCEPTED", revision: row.revision })).status).toBe(409);

  const rejected = await seeded(page, [para("p1", text("Body"))], "REJECTED", [open]);
  expect((await consoleCall(page, "console.suggestion.update", { contentId: rejected.item.id, id: "g1", status: "ACCEPTED", revision: rejected.revision })).status).toBe(400);
});

// The same from the review screen: the Numbers button makes an orderedList, and its autosave is stored.
test("a numbered list made with the editor toolbar autosaves", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [
    { type: "heading", attrs: { id: "h1", level: 2 }, content: [text("Numbered")] }, para("p1", text("First point")),
  ] });
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await page.locator(".item", { hasText: "Numbered" }).click();
  const paragraph = page.locator(".ProseMirror p", { hasText: "First point" });
  await paragraph.click();
  await page.waitForTimeout(100); // ProseMirror takes the caret from the DOM ~20ms after focus (#137)
  await page.getByRole("button", { name: "Numbers" }).click();
  await expect(page.locator(".ProseMirror ol")).toBeVisible();
  await expect.poll(async () => (await storedDoc(item.id)).content.some((b) => b.type === "orderedList"), { timeout: 10_000 }).toBe(true);
});
