import { expect, test } from "next/experimental/testmode/playwright";

for (const path of ["/institutions/sign-in", "/admin/sign-in"]) {
  test(`${path} uses DM Sans and split Noto Sans KR slices`, async ({ page }) => {
    const fontBodies: Promise<Buffer>[] = [];
    page.on("response", (res) => {
      if (res.request().resourceType() === "font") fontBodies.push(res.body());
    });
    await page.goto(path);
    await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans.*Noto Sans KR/);
    await page.evaluate(() => {
      document.body.append(Object.assign(document.createElement("p"), { textContent: "한국어 안녕하세요" }));
    });
    const family = '16px "Noto Sans KR Variable"';
    await expect.poll(() => page.evaluate((f) => document.fonts.load(f, "한").then(() => document.fonts.check(f, "한")), family)).toBe(true);
    const fontSizes = (await Promise.all(fontBodies)).map((body) => body.length);
    expect(fontSizes.length).toBeGreaterThan(0);
    expect(Math.max(...fontSizes)).toBeLessThan(1_000_000);
  });
}

test("visitor home registers the 700 Korean face", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toBeVisible();
  const families = await page.evaluate(() => [...document.fonts].map((f) => f.family));
  expect(families.some((f) => f.includes("NotoSansKR_700Bold"))).toBe(true);
});
