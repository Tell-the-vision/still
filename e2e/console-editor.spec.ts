import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 편집기 (Tiptap): the review screen edits the doc, autosaves it, and scraps sentences.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = { content: { type: string; content?: { text: string; marks?: { type: string }[] }[] }[] };
const docOf = async (id: string) => (await e2eSql<{ doc: Doc }>("SELECT doc FROM contents WHERE id = $1", [id]))[0].doc;

async function open(page: Page, trailing: object[] = []) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, {
    kind: "CLOSING",
    status: "READY",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Farewell" }] },
      { type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: "Old words." }] },
      ...trailing,
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
  // The preview starts closed below 1600px; open it once.
  const previewToggle = page.getByRole("button", { name: "Visitor preview" });
  if ((await previewToggle.getAttribute("aria-pressed")) !== "true") await previewToggle.click();
  await expect(page.getByTestId("visitor-preview").getByText("Old words. Live.")).toBeVisible({ timeout: 500 });
});

test("Scrap marks the selected sentence", async ({ page }) => {
  const item = await open(page);
  await page.locator(".ProseMirror").getByText("Old words.").click({ clickCount: 3 });
  await page.getByRole("button", { name: "Scrap" }).click();
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].marks?.[0].type).toBe("scrap");
});

test("a save that lost to another edit loads the latest version and says so", async ({ page }) => {
  const item = await open(page);
  const doc = { type: "doc", content: [
    { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Farewell" }] },
    { type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: "Words from elsewhere." }] },
  ] };
  await e2eSql("UPDATE contents SET doc = $2, revision = gen_random_uuid() WHERE id = $1", [item.id, JSON.stringify(doc)]);
  await page.locator(".ProseMirror").getByText("Old words.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Mine.");
  await expect(page.getByText("This item changed elsewhere. The latest version is loaded.")).toBeVisible();
  await expect(page.locator(".ProseMirror").getByText("Words from elsewhere.")).toBeVisible();
});

test("the slash menu turns an empty block into a quote", async ({ page }) => {
  const item = await open(page, [{ type: "paragraph", attrs: { id: "b2" } }]);
  await page.locator(".ProseMirror p").last().click();
  await page.keyboard.type("/");
  await expect(page.getByRole("listbox", { name: "Insert block" })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Insert block" }).getByRole("option")).toHaveCount(7);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator(".ProseMirror blockquote")).toHaveCount(1);
  await expect(page.getByRole("listbox", { name: "Insert block" })).toHaveCount(0);
  await expect.poll(async () => (await docOf(item.id)).content.map((n) => n.type)).toContain("blockquote");
});
