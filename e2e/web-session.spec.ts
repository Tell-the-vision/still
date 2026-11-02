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

test("signed-in Home shows Welcome back with the tab bar, and cookie requests must match the origin", async ({ page, next, request, baseURL }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await continueWithGoogle(page);
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);

  const session = (await page.context().cookies()).find((c) => c.name === "still_session");
  const call = (origin: string) =>
    request.post("/api/trpc/me.get?batch=1", {
      headers: { cookie: `still_session=${session?.value}`, origin, "content-type": "application/json" },
      data: {},
    });
  const forged = await call("http://evil.example");
  expect(forged.status()).toBe(403);
  expect(JSON.stringify(await forged.json())).toContain("FORBIDDEN");
  expect((await call(baseURL!)).status()).toBe(200);
});

test("a lost session sends the user to the login screen with the session-ended notice", async ({ page, next }) => {
  await page.clock.install();
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await continueWithGoogle(page);
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await page.context().clearCookies({ name: "still_session" });
  // /archive has no screen yet, so trigger the stale me.get refetch by refocusing the page.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByText("Your session ended. Sign in again.")).toBeVisible();
});
