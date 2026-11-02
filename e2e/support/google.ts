import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { NextFixture } from "next/experimental/testmode/playwright";

// SPEC §2.8: server-side fetch stub. Answers Google's token endpoint with an unsigned id_token for `user`.
export function stubGoogleToken(next: NextFixture, user: ReturnType<typeof newUser>) {
  next.onFetch((request) => {
    if (request.url !== "https://oauth2.googleapis.com/token") return undefined;
    const claims = { iss: "https://accounts.google.com", aud: "test-google-web-id", sub: user.sub, email: user.email, name: user.name, exp: Math.floor(Date.now() / 1000) + 3600 };
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const idToken = `${part({ alg: "none" })}.${part(claims)}.`;
    return Response.json({ id_token: idToken, refresh_token: "test-refresh", access_token: "test-access", expires_in: 3600 });
  });
}

// Home → Login → Continue with Google. A first-time user also agrees on the consent screen (SPEC §2.2 Consent).
export async function signIn(page: Page, { firstTime = true } = {}) {
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  if (firstTime) await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
}

export function newUser() {
  const sub = `g-${randomUUID()}`;
  return { sub, email: `${sub}@example.test`, name: "Test User" };
}

// SPEC §2.8 start-route interceptor. Only the first URL of a redirect chain is routable,
// so fetch the 302 ourselves, record it, and fulfill a stub page instead of reaching Google.
export async function captureAuthorize(page: Page) {
  const captured = { location: "", setCookie: "" };
  await page.route(/\/api\/auth\/google(\?|$)/, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    captured.location = res.headers()["location"] ?? "";
    captured.setCookie = res.headers()["set-cookie"] ?? "";
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>stub</p>" });
  });
  return captured;
}

// SPEC §2.8: replaces Google. Fulfills the start route with HTML that navigates to our callback,
// because a 302 to the callback would skip routing. `cancel` simulates the user denying consent.
export async function stubGoogle(page: Page, opts: { cancel?: boolean } = {}) {
  const stub = { callbackUrl: "" };
  await page.route(/\/api\/auth\/google(\?|$)/, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    const origin = new URL(route.request().url()).origin;
    const state = new URL(res.headers()["location"]).searchParams.get("state") ?? "";
    const cookie = (res.headers()["set-cookie"] ?? "").split(";")[0];
    const [name, ...value] = cookie.split("=");
    // Same Path as the real cookie, so the callback's clearing Set-Cookie removes it.
    await page.context().addCookies([{ name, value: value.join("="), domain: new URL(origin).hostname, path: "/api/auth" }]);
    const result = opts.cancel ? "error=access_denied" : "code=test";
    const callback = `${origin}/api/auth/google/callback?${result}&state=${state}`;
    stub.callbackUrl = callback;
    await route.fulfill({ status: 200, contentType: "text/html", body: `<script>location.replace(${JSON.stringify(callback)})</script>` });
  });
  return stub;
}
