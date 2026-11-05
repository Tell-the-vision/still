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
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");
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

test("Scrap marks the selected sentence", async ({ page }) => {
  const item = await open(page);
  await page.locator(".ProseMirror").getByText("Old words.").click({ clickCount: 3 });
  await page.getByRole("button", { name: "Scrap" }).click();
  await expect.poll(async () => (await docOf(item.id)).content[1].content?.[0].marks?.[0].type).toBe("scrap");
});
