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
  await submit(page, "https://evil.example/e/forms-of-stillness");
  await expect(page.getByText("STILL 전시 QR이 아닙니다")).toBeVisible();
  await expect(page).toHaveURL(/\/scan$/);
  await submit(page, "hello world");
  await expect(page.getByText("STILL 전시 QR이 아닙니다")).toBeVisible();
});

test("a code opens the guide", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
});
