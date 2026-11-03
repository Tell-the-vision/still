import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { NextFixture } from "next/experimental/testmode/playwright";

const signingKey = generateKeyPair("RS256");

async function signIdToken(user: ReturnType<typeof newUser>, privateKey: CryptoKey) {
  const claims = { sub: user.sub, email: user.email, name: user.name };
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://accounts.google.com").setAudience("test-google-web-id").setExpirationTime("1h").sign(privateKey);
}

// SPEC §2.8: server-side fetch stub. Answers Google's token endpoint with an id_token for `user` and its JWKS URL with the signing public key.
// `forged` signs with a key Google never published.
export function stubGoogleToken(next: NextFixture, user: ReturnType<typeof newUser>, { forged = false } = {}) {
  next.onFetch(async (request) => {
    if (request.url === "https://www.googleapis.com/oauth2/v3/certs") {
      return Response.json({ keys: [{ ...(await exportJWK((await signingKey).publicKey)), kid: "test-key", alg: "RS256", use: "sig" }] });
    }
    if (request.url !== "https://oauth2.googleapis.com/token") return undefined;
    const privateKey = forged ? (await generateKeyPair("RS256")).privateKey : (await signingKey).privateKey;
    return Response.json({ id_token: await signIdToken(user, privateKey), refresh_token: "test-refresh", access_token: "test-access", expires_in: 3600 });
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
    const state = new URL(res.headers()["location"]).searchParams.get("state") ?? "";
    // route.fetch already stored the state cookie (with its real Path) in the context jar.
    const callback = new URL("/api/auth/google/callback", route.request().url());
    callback.search = new URLSearchParams(opts.cancel ? { error: "access_denied", state } : { code: "test", state }).toString();
    stub.callbackUrl = callback.href;
    await route.fulfill({ status: 200, contentType: "text/html", body: `<script>location.replace(${JSON.stringify(callback.href)})</script>` });
  });
  return stub;
}
