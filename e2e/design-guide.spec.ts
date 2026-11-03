import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("Guide: hierarchy, commentary section and journal link", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("EXHIBITION / 2026")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Forms of Stillness" })).toHaveCSS("font-size", "38px");
  await expect(page.getByRole("heading", { name: "Your keepsake" })).toHaveCSS("font-size", "18px");
  await expect(page.getByText("COMMENTARY GUIDE / COLLECT A LINE")).toHaveCount(0);
  await expect(page.getByText(/A room can hold its breath/)).toHaveCSS("font-family", /Montserrat/);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await expect(page).toHaveURL(/\/journal(\?|$)/);
});

test("Guide: an unknown exhibition offers a way back to QR Scan", async ({ page }) => {
  await openGuide(page, "no-such");
  await expect(page.getByRole("heading", { name: "Not available." })).toBeVisible();
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan/);
});
