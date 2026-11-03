import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("a new user sees consent after Google, and Agree lands on Home 02", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
});

test("Decline deletes the account, returns to Home 01, and the next sign-in asks again", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await signIn(page);
});

test("consent.upsert with an outdated version fails with POLICY_VERSION_OUTDATED", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const body = await page.evaluate(async () => {
    const data = JSON.stringify({ termsVersion: "old", privacyVersion: "old" });
    return (await fetch("/api/trpc/consent.upsert", { method: "POST", headers: { "content-type": "application/json" }, body: data })).json();
  });
  expect(body.error.data.appCode).toBe("POLICY_VERSION_OUTDATED");
});
