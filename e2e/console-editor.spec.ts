import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 편집기 (Tiptap): the review screen edits the doc, autosaves it, and scraps sentences.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = { content: { type: string; content?: { text: string; marks?: { type: string }[] }[] }[] };
const docOf = async (id: string) => (await e2eSql<{ doc: Doc }>("SELECT doc FROM contents WHERE id = $1", [id]))[0].doc;

async function open(page: Page) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, {
    kind: "CLOSING",
    status: "READY",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Farewell" }] },
      { type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: "Old words." }] },
    ],
  });
  await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    doc: [{ type: "heading", attrs: { id: "h2", level: 2 }, content: [{ type: "text", text: "Other item" }] }],
  });
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await page.locator(".item", { hasText: "Farewell" }).click();
  return item;
}

test("typing in the editor autosaves the doc", async ({ page }) => {
  const item = await open(page);
  const body = page.locator(".ProseMirror");
  await body.getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" New words.");
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].text).toBe("Old words. New words.");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
});

test("an edit typed just before switching items is saved, not dropped", async ({ page }) => {
  const item = await open(page);
  await page.locator(".ProseMirror").getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Quick.");
  await page.locator(".item", { hasText: "Other item" }).click();
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].text).toBe("Old words. Quick.");
  await page.reload();
  await page.locator(".item", { hasText: "Farewell" }).click();
  await expect(page.locator(".ProseMirror").getByText("Old words. Quick.")).toBeVisible();
});

test("the visitor preview shows an edit before autosave", async ({ page }) => {
  await open(page);
  await page.locator(".ProseMirror").getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Live.");
  await expect(page.getByTestId("visitor-preview").getByText("Old words. Live.")).toBeVisible({ timeout: 500 });
});

test("Scrap marks the selected sentence", async ({ page }) => {
  const item = await open(page);
  await page.locator(".ProseMirror").getByText("Old words.").click({ clickCount: 3 });
  await page.getByRole("button", { name: "Scrap" }).click();
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].marks?.[0].type).toBe("scrap");
});

// The details form (note, theme, type) must not send the text it was opened with: after an edit in the
// editor, "Save changes" used to put the old paragraph back. The editor keeps its cursor across its own saves,
// and an approved item that is edited shows "In review" at once (the server moved it, SPEC §10.8).
test("saving the editorial note keeps the editor's text, and the cursor survives the autosave", async ({ page }) => {
  const item = await open(page);
  const body = page.locator(".ProseMirror");
  await body.getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" New words.");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  // Still focused after the save: the editor was not remounted.
  await page.keyboard.type(" More.");
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].text).toBe("Old words. New words. More.");

  await page.getByLabel("Editorial note (optional)").fill("Check the date.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  const [row] = await e2eSql<{ editorial_note: string; doc: Doc }>("SELECT editorial_note, doc FROM contents WHERE id = $1", [item.id]);
  expect(row.editorial_note).toBe("Check the date.");
  expect(row.doc.content[1].content?.[0].text).toBe("Old words. New words. More.");
  await expect(body.getByText("Old words. New words. More.")).toBeVisible();
});

test("editing an approved item in the editor shows it back in review without a reload", async ({ page }) => {
  const item = await open(page);
  await page.getByRole("button", { name: "Approve item" }).click();
  await expect(page.locator(".editor .badge", { hasText: "Approved" })).toBeVisible();
  await page.locator(".ProseMirror").getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Changed.");
  await expect(page.locator(".editor .badge", { hasText: "In review" })).toBeVisible();
  await expect.poll(async () => (await e2eSql<{ status: string }>("SELECT status FROM contents WHERE id = $1", [item.id]))[0].status).toBe("READY");
});
