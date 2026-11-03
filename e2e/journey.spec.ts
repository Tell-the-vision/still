import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

// The whole product path (SPEC §1): guest entry, login, record, web card, PNG, log out.
test("a guest scans, signs in, records, makes a web card, downloads the PNG and logs out", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await openGuide(page, "forms-of-stillness");

  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);

  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  // Saving returns to Archive Detail, which shows the time.
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();

  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await page.getByRole("link", { name: "Make your card" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG" }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.png$/);

  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
});
