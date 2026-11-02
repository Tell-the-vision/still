import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("My Archive lists visited exhibitions", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByText("My Archive", { exact: true })).toBeVisible();
  await expect(page.getByText("01 EXPERIENCES")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forms of Stillness" })).toBeVisible();
});

test("an empty archive points to QR Scan", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await expect(page.getByText("No archives yet.")).toBeVisible();
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);
});
