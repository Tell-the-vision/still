import { expect, test } from "next/experimental/testmode/playwright";

for (const path of ["/institutions/sign-in", "/admin/sign-in"]) {
  test(`${path} uses DM Sans and split Noto Sans KR slices`, async ({ page }) => {
    // Slices keep arriving while the page renders Korean, so a body read after the test ends counts as 0.
    const fontSizes: Promise<number>[] = [];
    const fontUrls: string[] = [];
    page.on("response", (res) => {
      if (res.request().resourceType() !== "font") return;
      fontSizes.push(res.body().then((body) => body.length, () => 0));
      fontUrls.push(res.url());
    });
    await page.goto(path);
    await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans.*Noto Sans KR/);
    await page.evaluate(() => {
      document.body.append(Object.assign(document.createElement("p"), { textContent: "한국어 안녕하세요" }));
    });
    // document.fonts.check() is also true when no face of the family exists, so require the faces and a slice download.
    const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes("Noto Sans KR")).length);
    expect(faces).toBeGreaterThan(0);
    const family = '16px "Noto Sans KR Variable"';
    await expect.poll(() => page.evaluate((f) => document.fonts.load(f, "한").then(() => document.fonts.check(f, "한")), family)).toBe(true);
    await expect.poll(() => fontUrls.some((url) => /noto-sans-kr/.test(url))).toBe(true);
    const sizes = await Promise.all(fontSizes);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThan(1_000_000);
  });
}

test("visitor home registers the 700 Korean face", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toBeVisible();
  const families = await page.evaluate(() => [...document.fonts].map((f) => f.family));
  expect(families.some((f) => f.includes("NotoSansKR_700Bold"))).toBe(true);
});
