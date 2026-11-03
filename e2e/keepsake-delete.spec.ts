import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("deleting the keepsake keeps the kept lines and the journal", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  // Saving returns to the guide, whose footer shows the time.
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await page.getByRole("link", { name: "Make your card" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);

  const dialog = page.getByRole("dialog", { name: "Delete keepsake" });
  await page.getByRole("button", { name: "Delete keepsake" }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("link", { name: "Edit card" })).toBeVisible();

  await page.getByRole("button", { name: "Delete keepsake" }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("link", { name: "Make your card" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
});
