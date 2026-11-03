import { expect, test } from "next/experimental/testmode/playwright";

test("the phone header offers QR Scan as an icon-only link with a 44px hit area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e/forms-of-stillness");
  const link = page.getByRole("link", { name: "QR Scan" });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText("");
  const box = await link.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "/tmp/still-shots/qr/header-icon-390.png", clip: { x: 0, y: 0, width: 390, height: 120 } });
  await link.click();
  await expect(page).toHaveURL(/\/scan$/);
});
