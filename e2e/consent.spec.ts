import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { e2eSql } from "./support/staff";

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

// A policy update asks everyone again: an agreement to older versions no longer opens personal data,
// and the app sends the user back to the consent screen.
test("consent to older policy versions is not current: personal data answers CONSENT_REQUIRED and the app asks again", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  expect((await trpcCall(page, "archive.list", { limit: 1 })).status).toBe(200);

  await e2eSql("UPDATE user_consents SET terms_version = 'old', privacy_version = 'old' WHERE user_id = (SELECT user_id FROM user_tokens WHERE subject = $1)", [user.sub]);
  const refused = await trpcCall(page, "archive.list", { limit: 1 });
  expect(refused.status).toBe(403);
  expect(refused.json.error.data.appCode).toBe("CONSENT_REQUIRED");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Agree" })).toBeVisible();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
  expect((await trpcCall(page, "archive.list", { limit: 1 })).status).toBe(200);
});
