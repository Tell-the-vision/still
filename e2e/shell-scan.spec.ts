import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const shots = "/tmp/still-shots/shell2";

test("phone header QR Scan opens /scan from Home 02 and a guide, and is absent on /scan", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await expect(page.getByRole("link", { name: "QR Scan" })).toHaveCount(1);
  await page.screenshot({ path: `${shots}/phone-home.png` });
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("link", { name: "QR Scan" })).toHaveCount(0);

  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("heading", { name: "Forms of Stillness" })).toBeVisible();
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("no QR Scan link, and the wheel scrolls over the side margins", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/e/forms-of-stillness");
    await expect(page.getByRole("heading", { name: "Forms of Stillness" })).toBeVisible();
    await expect(page.getByRole("link", { name: "QR Scan" })).toHaveCount(0);
    const before = await page.getByRole("heading", { name: "Forms of Stillness" }).boundingBox();
    await page.mouse.move(40, 300);
    await page.mouse.wheel(0, 800);
    await expect.poll(async () => (await page.getByRole("heading", { name: "Forms of Stillness" }).boundingBox())!.y).toBeLessThan(before!.y - 100);
  });

  test("the keepsake card is centred in the column", async ({ page, next }) => {
    stubGoogleToken(next, newUser());
    await stubGoogle(page);
    await signIn(page);
    await page.goto("/e/forms-of-stillness");
    await page.getByRole("button", { name: "Keep this line" }).first().click();
    await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
    await page.goto("/archive/forms-of-stillness/keepsake");
    const card = await page.getByLabel("Web card", { exact: true }).boundingBox();
    expect(card!.x + card!.width / 2).toBeCloseTo(640, -1);
    await page.screenshot({ path: `${shots}/desktop-keepsake.png` });
  });
});
