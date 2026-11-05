import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

test.use({ viewport: { width: 1440, height: 900 } });

// #137: the first click into the item text must place the caret where it lands, not at the document start.
test("one click past the end of a paragraph, then Enter and typing, adds a block after it", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [
    { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Title here" }] },
    { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "First paragraph." }] },
  ] });
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await page.locator(".item", { hasText: "Title here" }).click();

  const paragraph = page.locator(".ProseMirror p", { hasText: "First paragraph." });
  const width = await paragraph.evaluate((el) => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().width; });
  await paragraph.click({ position: { x: Math.ceil(width) + 2, y: 9 } }); // once
  // ProseMirror takes its selection from the DOM about 20ms after the editor gains focus; a person never
  // types that fast, so the test waits a human beat before pressing Enter.
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second paragraph.");

  await expect(page.locator(".ProseMirror > *")).toHaveText(["Title here", "First paragraph.", "Second paragraph."]);
  await expect.poll(async () => {
    const [row] = await e2eSql<{ doc: { content: { content?: { text: string }[] }[] } }>("SELECT doc FROM contents WHERE id = $1", [item.id]);
    return row.doc.content.map((b) => (b.content ?? []).map((t) => t.text).join(""));
  }, { timeout: 10_000 }).toEqual(["Title here", "First paragraph.", "Second paragraph."]);
});
