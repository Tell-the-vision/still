import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("a cancelled link attempt returns to Account with the failed notice and one row", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await stubGoogle(page, { cancel: true });
  await page.getByRole("button", { name: "Link another Google account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Couldn't link the account. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(1);
});

test("the link start route needs a session and the intent must be known", async ({ request }) => {
  const res = await request.get("/api/auth/google?intent=link&returnTo=/account", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const location = new URL(res.headers()["location"]);
  expect(location.pathname + location.search).toBe("/account?link=failed");
  expect((await request.get("/api/auth/google?intent=merge", { maxRedirects: 0 })).status()).toBe(400);
});
