import type { Page } from "@playwright/test";

// User path to a guide: Home → QR Scan → enter the code → Open.
export async function openGuide(page: Page, code: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await page.getByLabel("Exhibition URL or code").fill(code);
  await page.getByRole("button", { name: "Open" }).click();
}
