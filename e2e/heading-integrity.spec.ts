import type { Locator } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// Headings look the same wherever an item is read: in the console's editor, in its phone preview and on the visitor's
// page (/e/{code}/{page}). The editor sets the look; the item's first heading is its title.

test.use({ viewport: { width: 1700, height: 1000 } });

const text = (t: string) => [{ type: "text", text: t }];
const DOC = [
  { type: "heading", attrs: { id: "t", level: 2 }, content: text("Harbour at dusk") },
  { type: "paragraph", attrs: { id: "p1" }, content: text("Oil on canvas.") },
  { type: "heading", attrs: { id: "s", level: 2 }, content: text("The light") },
  { type: "paragraph", attrs: { id: "p2" }, content: text("Late sun on the water.") },
  { type: "heading", attrs: { id: "d", level: 3 }, content: text("Up close") },
  { type: "paragraph", attrs: { id: "p3" }, content: text("Small strokes.") },
];
const HEADINGS = ["Harbour at dusk", "The light", "Up close"];

// What decides a heading's look, with the face reduced to display or text (the console names Futura first and
// falls back to Montserrat, which is what the visitor app ships). The visitor app picks a weight by its font file
// (DMSans_600SemiBold), not by font-weight, so that is where its weight is read.
async function look(heading: Locator) {
  const s = await heading.evaluate((el) => {
    const c = getComputedStyle(el);
    return { family: c.fontFamily, size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight };
  });
  const fileWeight = /_(\d00)[A-Za-z]/.exec(s.family.split(",")[0])?.[1];
  return { face: /Futura|Montserrat/.test(s.family) ? "display" : "text", size: s.size, weight: fileWeight ?? s.weight, lineHeight: s.lineHeight };
}
const looks = (scope: (name: string) => Locator) => Promise.all(HEADINGS.map((name) => look(scope(name))));

test("an item's headings look the same in the editor, its phone preview and the visitor's page", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account, { state: "PUBLISHED" });
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "APPROVED", doc: DOC });
  const prefix = item.id.slice(0, 8);
  const guide = { version: 1, type: "doc", content: DOC.map((b) => ({ ...b, attrs: { ...b.attrs, id: `${prefix}-${b.attrs.id}` } })) };
  await e2eSql("UPDATE exhibitions SET guide = $2 WHERE id = $1", [exhibition.id, JSON.stringify(guide)]);

  await signInConsole(page, account);
  await page.goto("/console/");
  const editor = page.locator(".ProseMirror");
  await expect(editor.getByText("Harbour at dusk")).toBeVisible();
  const inEditor = await looks((name) => editor.locator("h2, h3", { hasText: name }));

  const preview = page.frameLocator('[data-testid="visitor-preview"]');
  await expect(preview.getByRole("heading", { name: "Harbour at dusk" })).toBeVisible();
  const inPreview = await looks((name) => preview.getByRole("heading", { name }));

  await page.goto(`/e/${exhibition.code}/${prefix}`);
  await expect(page.getByRole("heading", { name: "Harbour at dusk" })).toBeVisible();
  const onPage = await looks((name) => page.getByRole("heading", { name }));

  expect(inPreview).toEqual(inEditor);
  expect(onPage).toEqual(inEditor);
});
