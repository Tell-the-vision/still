import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("ACCOUNT lists the linked Google identity and opens policy links in a new tab", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByRole("heading", { name: "LINKED ACCOUNTS" })).toBeVisible();
  await expect(page.getByText(`Google · ${user.email}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("target", "_blank");
});

test("Unlink can be cancelled, and the only identity cannot be unlinked", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  const row = page.getByText(`Google · ${user.email}`);
  await page.getByRole("button", { name: "Unlink" }).first().click();
  await page.getByRole("dialog", { name: "Unlink account" }).getByRole("button", { name: "Cancel" }).click();
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Unlink" }).first().click();
  await page.getByRole("dialog", { name: "Unlink account" }).getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByText("This is your only sign-in. Use Delete account instead.")).toBeVisible();
  await expect(row).toBeVisible();
});
