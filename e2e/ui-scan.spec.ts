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

test("an invalid code shows the notice in view and Open is primary", async ({ page }) => {
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await page.getByLabel("Exhibition URL or code").fill("not a valid code!!");
  const open = page.getByRole("button", { name: "Open" });
  await expect(open).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await open.click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("STILL 전시 QR이 아닙니다");
  await expect(alert).toBeInViewport();
});

test("the field uses the body font and the headline is a heading", async ({ page }) => {
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await expect(page.getByLabel("Exhibition URL or code")).toHaveCSS("font-family", /DMSans/);
  await expect(page.getByRole("heading", { name: "Scan to enter." })).toBeVisible();
});

test("on desktop the camera frame is capped so the fallback entry and Open sit above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/scan");
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  const frame = await page.getByLabel("QR code viewfinder").boundingBox();
  const open = page.getByRole("button", { name: "Open" });
  const box = await open.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(800);
  expect(frame && frame.width <= 320).toBeTruthy();
  await page.screenshot({ path: "/tmp/still-qa/account/after/desk-scan.png" });
});
