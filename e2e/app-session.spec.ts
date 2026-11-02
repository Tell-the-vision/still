import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, stubGoogleToken } from "./support/google";

const REDIRECT = "still:///oauthredirect";

// Calls the API from the page, as the native app does. Home is reached first (SPEC §1.1).
async function callFromHome(page: Page, path: string, headers: Record<string, string>, body: unknown) {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    async ({ path, headers, body }) => {
      const res = await fetch(`/api/trpc/${path}`, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json() };
    },
    { path, headers, body },
  );
}

const create = (page: Page, redirectUri: string) =>
  callFromHome(page, "session.create", { "x-client": "ios" }, { provider: "GOOGLE", code: "test", codeVerifier: "v", redirectUri });

test("session.create returns tokens and a Bearer token authenticates without a cookie or matching Origin", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  const { status, json } = await create(page, REDIRECT);
  const { accessToken, refreshToken, expiresIn, user } = json.result.data;
  expect([status, typeof accessToken, typeof refreshToken, expiresIn]).toEqual([200, "string", "string", 900]);

  const headers = { authorization: `Bearer ${accessToken}`, origin: "http://evil.example", "content-type": "application/json" };
  const me = await page.request.post("/api/trpc/me.get", { headers, data: {} });
  expect(me.status()).toBe(200);
  expect((await me.json()).result.data.id).toBe(user.id);
});

test("session.create rejects a redirectUri outside the allow-list", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  expect((await create(page, "https://evil.example/cb")).status).toBe(400);
});

test("concurrent first sign-ins for one Google account resolve to one user", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await page.goto("/"); // parallel calls would race to navigate
  const [a, b] = await Promise.all([create(page, REDIRECT), create(page, REDIRECT)]);
  expect(a.json.result.data.user.id).toBe(b.json.result.data.user.id);
});
