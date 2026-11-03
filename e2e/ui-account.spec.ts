import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("Account uses kit headings, hides the button arrow from screen readers, and labels the delete dialog", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(page.getByText("Log out →")).toBeVisible();
  await expect(page.getByRole("heading", { name: "PREFERENCES" })).toBeVisible();
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Delete account" })).toBeVisible();
});

test("Account text actions follow the design", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toHaveCSS("font-size", "32px");
  await expect(page.getByText(user.email, { exact: true }).first()).toHaveCSS("color", "rgb(102, 102, 102)");
  const logOut = page.getByRole("button", { name: "Log out", exact: true });
  await expect(logOut).toHaveCSS("border-top-width", "0px");
  await expect(logOut.getByText("Log out", { exact: true })).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.getByRole("button", { name: "Delete account", exact: true }).getByText("Delete account", { exact: true })).toHaveCSS("color", "rgb(102, 102, 102)");
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("target", "_blank");
});
