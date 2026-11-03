import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("the wordmark links Home", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "STILL, home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("on desktop the tabs sit in the header and there is no bottom bar", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toHaveCount(1);
  await expect.poll(async () => (await nav.boundingBox())?.y ?? 9999).toBeLessThan(100);
  await page.screenshot({ path: "/tmp/still-shots/shell/desktop-home.png" });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("on a phone the bottom bar exists and the header has no MY ARCHIVE", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const box = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  expect(box!.y).toBeGreaterThan(600);
  await expect(page.getByRole("link", { name: "MY ARCHIVE" })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/still-shots/shell/phone-home.png" });
});
});

test("a guest on desktop is sent to login from the ARCHIVE tab", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/scan");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
