import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

async function openJournal(page: Page, next: Parameters<typeof stubGoogleToken>[0]) {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("link", { name: "Write a journal" }).click();
  return page.getByRole("textbox", { name: "Journal" });
}

test("leaving with unsaved text asks; Stay keeps it, Leave goes back", async ({ page, next }) => {
  const field = await openJournal(page, next);
  await field.fill("Unsaved thought");
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
  await expect(dialog.getByText("Your draft is kept on this device.")).toBeVisible();
  await dialog.getByRole("button", { name: "Stay" }).click();
  await expect(field).toHaveValue("Unsaved thought");

  await page.goBack();
  await page.getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
});

test("a clean journal leaves without a dialog", async ({ page, next }) => {
  await expect(await openJournal(page, next)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
