import { expect, test } from "next/experimental/testmode/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
});

test("Enter in the field opens the guide", async ({ page }) => {
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await page.getByLabel("Exhibition URL or code").fill("forms-of-stillness");
  await page.getByLabel("Exhibition URL or code").press("Enter");
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
});

test("the field uses the body font and the headline is a heading", async ({ page }) => {
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await expect(page.getByLabel("Exhibition URL or code")).toHaveCSS("font-family", /DMSans/);
  await expect(page.getByRole("heading", { name: "Scan to enter." })).toBeVisible();
});
