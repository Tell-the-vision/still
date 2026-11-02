import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("signed in: ACCOUNT tab shows the email, Log out returns to guest Home and clears the cookie", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText("Art stays with you.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://policy.test.invalid/terms");
  await page.getByRole("button", { name: "Log out →" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  expect((await page.context().cookies()).some((c) => c.name === "still_session")).toBe(false);
});

test("guest: ACCOUNT redirects to Login and returns to /account after Google", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(user.email)).toBeVisible();
});

async function openDeleteDialog(page: Page) {
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "Delete account →" }).click();
  await expect(page.getByText(/permanently deleted/)).toBeVisible();
}

test("Delete account revokes the Google token, returns to Home, and the same sub signs in as a new user", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  const revoked: string[] = [];
  next.onFetch(async (request) => {
    if (request.url !== "https://oauth2.googleapis.com/revoke") return undefined;
    revoked.push(await request.text());
    return new Response("{}");
  });
  await stubGoogle(page);
  await signIn(page);
  await openDeleteDialog(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  expect(revoked.join()).toContain("token=test-refresh");
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
});

test("Cancel keeps the account", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await openDeleteDialog(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
});
