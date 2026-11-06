import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { openGuide } from "./support/reach";
import { e2eSql, seedInstitutionAccount } from "./support/staff";

// On a wide window text runs the full column, as the pictures and the listen row do: a paragraph wraps at the column's
// right edge, and a line's keep mark sits on it, where the listen row's arrow is.
test.use({ viewport: { width: 1280, height: 900 } });

const LONG = "A long paragraph about the work, written to wrap over several lines on a wide window. ".repeat(5).trim();

test("each keep mark lines up with the listen row's right edge", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const row = (await page.getByRole("link", { name: /^Listen to .+ on Spotify$/ }).boundingBox())!;
  const marks = page.getByRole("button", { name: "Keep this line" });
  await expect(marks.first()).toBeVisible();
  for (const mark of await marks.all()) {
    const box = (await mark.boundingBox())!;
    expect(Math.abs(box.x + box.width - (row.x + row.width))).toBeLessThanOrEqual(1);
  }
});

test("a paragraph fills the column: it wraps where the keep marks end, not at a narrower measure", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account, { state: "PUBLISHED" });
  const page8 = randomUUID().slice(0, 8);
  const sentence = randomUUID();
  const guide = {
    version: 1,
    type: "doc",
    content: [
      { type: "heading", attrs: { id: `${page8}-h`, level: 2 }, content: [{ type: "text", text: "Harbour at dusk" }] },
      { type: "paragraph", attrs: { id: `${page8}-p` }, content: [{ type: "text", text: LONG }] },
      { type: "paragraph", attrs: { id: `${page8}-s` }, content: [{ type: "text", text: "Light stays longer than the boats.", marks: [{ type: "scrap", attrs: { sentenceId: sentence } }] }] },
    ],
  };
  await e2eSql("INSERT INTO guide_sentences (id, exhibition_id, content) VALUES ($1, $2, 'Light stays longer than the boats.')", [sentence, exhibition.id]);
  await e2eSql("UPDATE exhibitions SET guide = $2 WHERE id = $1", [exhibition.id, JSON.stringify(guide)]);

  await page.goto(`/e/${exhibition.code}/${page8}`);
  const paragraph = (await page.getByText(LONG, { exact: true }).boundingBox())!;
  const mark = (await page.getByRole("button", { name: "Keep this line" }).boundingBox())!;
  const title = (await page.getByRole("heading", { name: "Harbour at dusk" }).boundingBox())!;
  expect(Math.abs(paragraph.x - title.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(paragraph.x + paragraph.width - (mark.x + mark.width))).toBeLessThanOrEqual(1);
  expect(paragraph.width).toBeGreaterThan(600);
});
