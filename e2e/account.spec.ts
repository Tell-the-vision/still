import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, stubGoogle, stubGoogleToken } from "./support/google";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
}

test("signed in: ACCOUNT tab shows the email, Log out returns to guest Home and clears the cookie", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText("Art stays with you.")).toBeVisible();
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
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(user.email)).toBeVisible();
});
