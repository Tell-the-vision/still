import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

// On a wide window the guide's column is wider than its reading measure. A line's keep mark lines up with the column's
// right edge, where the listen row's arrow is, and not at the end of the 520px measure, mid-column.
test.use({ viewport: { width: 1280, height: 900 } });

test("each keep mark lines up with the listen row's right edge, and the line keeps its reading measure", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const row = (await page.getByRole("link", { name: /^Listen to .+ on Spotify$/ }).boundingBox())!;
  const marks = page.getByRole("button", { name: "Keep this line" });
  await expect(marks.first()).toBeVisible();
  for (const mark of await marks.all()) {
    const box = (await mark.boundingBox())!;
    expect(Math.abs(box.x + box.width - (row.x + row.width))).toBeLessThanOrEqual(1);
  }
  const quote = (await page.getByText(/^“.+”$/).first().boundingBox())!;
  expect(quote.width).toBeLessThanOrEqual(520);
});
