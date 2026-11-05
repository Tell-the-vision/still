import { expect, test } from "next/experimental/testmode/playwright";

for (const path of ["/institutions/sign-in", "/admin/sign-in"]) {
  test(`${path} uses DM Sans and self-hosted Noto Sans KR`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans.*Noto Sans KR/);
    await expect.poll(() => page.evaluate(() => document.fonts.load('16px "Noto Sans KR"', "한").then(() => document.fonts.check('16px "Noto Sans KR"', "한")))).toBe(true);
  });
}
