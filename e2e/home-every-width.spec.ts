import { expect, test } from "next/experimental/testmode/playwright";

// Home 01 is the same at every width, from a phone to a half-width and a full desktop window (SPEC §1.1).
for (const width of [390, 800, 1280]) {
  test(`a guest at ${width}px sees Login and QR Scan without the list of works, and QR Scan opens the scanner`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Show works" })).toHaveCount(0);
    await page.getByRole("link", { name: "QR Scan" }).click();
    await expect(page).toHaveURL(/\/scan$/);
  });
}
