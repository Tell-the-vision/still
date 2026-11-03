import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("the guide title is a heading", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("heading", { name: "Forms of Stillness" })).toBeVisible();
});

test("the camera notice is a status", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page.getByRole("status")).toContainText("Camera access is off");
});

test("a failed document image disappears entirely", async ({ page }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ status: 404 }));
  await openGuide(page, "with-cover");
  await expect(page.getByText("With Cover", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Test cover")).toHaveCount(0);
});

test("a loaded image is exposed with its alt text", async ({ page }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  await openGuide(page, "with-cover");
  await expect(page.getByRole("img", { name: "Test cover" }).first()).toBeVisible();
});
