import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

async function submit(page: Page, value: string) {
  await page.getByLabel("Exhibition URL or code").fill(value);
  await page.getByRole("button", { name: "Open" }).click();
}

test("foreign URLs and junk are rejected without navigating", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await submit(page, "https://evil.example/e/forms-of-stillness");
  await expect(page.getByText("STILL 전시 QR이 아닙니다")).toBeVisible();
  await expect(page).toHaveURL(/\/scan$/);
  await submit(page, "hello world");
  await expect(page.getByText("STILL 전시 QR이 아닙니다")).toBeVisible();
});

// Every QR the console prints is an artwork's (/e/{code}/{page}); scanned or typed, it opens that work's page.
test("an artwork's QR address opens that work's page", async ({ page, baseURL }) => {
  const pages = await page.request.get(`/api/trpc/exhibition.pages?input=${encodeURIComponent(JSON.stringify({ scope: "ALL" }))}`);
  const work = ((await pages.json()).result.data.items as { code: string; page: string }[]).find((i) => i.code === "forms-of-stillness")!;
  await page.goto("/scan");
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await submit(page, `${baseURL}/e/forms-of-stillness/${work.page}`);
  await expect(page).toHaveURL(new RegExp(`/e/forms-of-stillness/${work.page}$`));
  await expect(page.getByText("A room can hold its breath.")).toBeVisible();
});

test("a code opens the guide", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
});

test("without camera permission the notice and URL entry show", async ({ page }) => {
  // The fake-ui launch flag auto-accepts prompts, so deny by rejecting getUserMedia.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page.getByText("Camera access is off. Enter the exhibition URL instead.")).toBeVisible();
  await expect(page.getByLabel("Exhibition URL or code")).toBeVisible();
});

test("with camera permission the viewfinder shows", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["camera"] });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page.locator("video")).toBeVisible();
  await context.close();
});

test("guest sees the scanner and reveals URL entry on request", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page.getByRole("heading", { name: "Scan to enter." })).toBeVisible();
  await expect(page.getByLabel("QR code viewfinder")).toBeVisible();
  await expect(page.getByLabel("Exhibition URL or code")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await expect(page.getByLabel("Exhibition URL or code")).toBeFocused();
  await page.getByLabel("Exhibition URL or code").fill("forms-of-stillness");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Forms of Stillness" })).toBeVisible();
});
