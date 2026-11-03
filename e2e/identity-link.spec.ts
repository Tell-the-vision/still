import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

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

async function linkAnother(page: Page) {
  await page.getByRole("button", { name: "Link another Google account" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

const listIdentities = async (page: Page): Promise<{ id: string }[]> =>
  (await trpcCall(page, "identity.list", {})).json.result.data;

test("link a second account, unlink it, link again, then sign in as it", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  Object.assign(user, newUser());
  await linkAnother(page);
  await expect(page.getByText("Account linked.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(2);
  await page.getByRole("button", { name: "Unlink" }).nth(1).click();
  await page.getByRole("dialog", { name: "Unlink account" }).getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(1);
  await linkAnother(page);
  await expect(page.getByText("Account linked.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await signIn(page, { firstTime: false });
  await expect(page.getByText("Forms of Stillness")).toBeVisible();
});

test("a sub owned by another account is a conflict, your own sub already exists", async ({ page, next }) => {
  const user = newUser();
  const owner = { ...user };
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await linkAnother(page);
  await expect(page.getByText("That Google account is already linked.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  Object.assign(user, newUser());
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  Object.assign(user, owner);
  await linkAnother(page);
  await expect(page.getByText("That Google account belongs to another STILL account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(1);
});

test("two concurrent unlinks leave one identity", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  Object.assign(user, newUser());
  await linkAnother(page);
  await expect(page.getByRole("button", { name: "Unlink" })).toHaveCount(2);
  const results = await Promise.all((await listIdentities(page)).map(({ id }) => trpcCall(page, "identity.delete", { identityId: id })));
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(results.find((r) => r.status === 409)?.json.error.data.appCode).toBe("LAST_IDENTITY");
  expect(await listIdentities(page)).toHaveLength(1);
});
