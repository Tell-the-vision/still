import type { Locator } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("Account uses kit headings, hides the button arrow from screen readers, and labels the delete dialog", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(page.getByText("Log out", { exact: true })).toBeVisible();
  for (const eyebrow of ["PREFERENCES", "LINKED ACCOUNTS", "ABOUT STILL", "GOOGLE"]) await expect(page.getByText(eyebrow, { exact: true })).toHaveCount(0);
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

test("Linked accounts and policy links have room between them", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  const box = async (locator: Locator) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("not rendered");
    return found;
  };
  const email = await box(page.getByText(user.email, { exact: true }).first());
  const unlink = await box(page.getByRole("button", { name: "Unlink" }));
  const another = await box(page.getByRole("button", { name: /Link another Google account/ }));
  expect(unlink.y - (email.y + email.height)).toBeGreaterThanOrEqual(8);
  expect(another.y - (unlink.y + unlink.height)).toBeGreaterThanOrEqual(16);
  const terms = await box(page.getByRole("link", { name: /Terms of Service/ }));
  const privacy = await box(page.getByRole("link", { name: /Privacy Policy/ }));
  expect(privacy.y - (terms.y + terms.height)).toBeGreaterThanOrEqual(12);
  const logOut = await box(page.getByRole("button", { name: "Log out", exact: true }));
  const remove = await box(page.getByRole("button", { name: "Delete account", exact: true }));
  const policyGap = privacy.y - (terms.y + terms.height);
  const actionGap = remove.y - (logOut.y + logOut.height);
  expect(Math.abs(actionGap - policyGap)).toBeLessThanOrEqual(2);
});

test("Account fits a phone: Log out scrolls fully above the tab bar and Unlink is a 44px target", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  const remove = page.getByRole("button", { name: "Delete account", exact: true });
  await remove.scrollIntoViewIfNeeded();
  const bar = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  const last = await remove.boundingBox();
  if (!bar || !last) throw new Error("not rendered");
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
  const unlink = await page.getByRole("button", { name: "Unlink" }).locator("..").boundingBox();
  expect(unlink?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "/tmp/still-qa/account/after/phone-account.png" });
});
