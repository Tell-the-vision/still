import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("the delete dialog shows a visible title in a padded panel", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Delete account" })).toBeVisible();
  await expect(dialog).toHaveCSS("padding-top", "24px");
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("the guide shows a formatted date range, not ISO dates", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText(/\d{4}-\d{2}-\d{2}/)).toHaveCount(0);
  await expect(page.getByText(/\d{1,2} [A-Z][a-z]{2} — /)).toBeVisible();
});

test("a cover-less archive card shows an outlined placeholder", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  const card = page.getByRole("link", { name: "Forms of Stillness", exact: true });
  // A cover-less tile shows the keepsake card in miniature, which draws its own 1px outline.
  const outlined = await card.evaluate((el) => [...el.querySelectorAll("div")].some((d) => getComputedStyle(d).borderTopWidth === "1px"));
  expect(outlined).toBe(true);
  await expect(card).toContainText("Forms of Stillness");
});
