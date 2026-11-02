import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, stubGoogle, stubGoogleToken } from "./support/google";

async function continueWithGoogle(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
}

const hasSession = async (page: Page) => (await page.context().cookies()).some((c) => c.name === "still_session");

test("Google sign-in lands on Home with an HttpOnly Lax session cookie", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await continueWithGoogle(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Sign-in failed. Try again.")).toHaveCount(0);
  const session = (await page.context().cookies()).find((c) => c.name === "still_session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("signing in again as the same Google account succeeds", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await continueWithGoogle(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Sign-in failed. Try again.")).toHaveCount(0);
  await expect.poll(() => hasSession(page)).toBe(true);
  await page.context().clearCookies();
  await continueWithGoogle(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Sign-in failed. Try again.")).toHaveCount(0);
  await expect.poll(() => hasSession(page)).toBe(true);
});

test("a rejected token exchange shows the failed notice and sets no session", async ({ page, next }) => {
  next.onFetch((request) => (request.url === "https://oauth2.googleapis.com/token" ? new Response("{}", { status: 400 }) : undefined));
  await stubGoogle(page);
  await continueWithGoogle(page);
  await expect(page.getByText("Sign-in failed. Try again.")).toBeVisible();
  expect(await hasSession(page)).toBe(false);
});
