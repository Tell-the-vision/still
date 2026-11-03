import { createHash } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, stubGoogleToken } from "./support/google";

const verifier = "v".repeat(50);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const start = (returnUrl: string) => `/api/auth/google/native-start?returnUrl=${encodeURIComponent(returnUrl)}&codeChallenge=${challenge}&state=n1`;
const headers = { "x-client": "ios", "x-client-version": "1.0.0" };

test("native sign-in relays through the web client", async ({ page, next, baseURL }) => {
  const relay = `${baseURL}/api/auth/google/native-callback`;
  const res = await page.request.get(start("still://oauthredirect"), { maxRedirects: 0 });
  const google = new URL(res.headers().location ?? "");
  expect([res.status(), google.host, google.searchParams.get("redirect_uri")]).toEqual([302, "accounts.google.com", relay]);
  expect(google.searchParams.get("code_challenge")).toBe(challenge);

  for (const bad of ["https://evil.example", "still://evil"]) {
    expect((await page.request.get(start(bad), { maxRedirects: 0 })).status()).toBe(400);
    const state = Buffer.from(JSON.stringify({ returnUrl: bad, nonce: "n1" })).toString("base64url");
    expect((await page.request.get(`/api/auth/google/native-callback?code=test&state=${state}`, { maxRedirects: 0 })).status()).toBe(400);
  }

  const state = google.searchParams.get("state") ?? "";
  const back = await page.request.get(`/api/auth/google/native-callback?code=test&state=${state}`, { maxRedirects: 0 });
  expect([back.status(), back.headers().location]).toEqual([302, "still://oauthredirect?code=test&state=n1"]);

  stubGoogleToken(next, newUser());
  // Google checks PKCE: the token endpoint rejects a verifier that does not hash to the challenge.
  next.onFetch(async (request) => {
    if (request.url !== "https://oauth2.googleapis.com/token") return undefined;
    const sent = new URLSearchParams(await request.clone().text()).get("code_verifier") ?? "";
    return createHash("sha256").update(sent).digest("base64url") === challenge ? undefined : Response.json({ error: "invalid_grant" }, { status: 400 });
  });
  await page.goto("/");
  const body = { provider: "GOOGLE", code: "test", codeVerifier: verifier, redirectUri: relay };
  const created = await trpcCall(page, "session.create", body, headers);
  expect(created.json.result.data.accessToken).toBeTruthy();

  const wrong = await trpcCall(page, "session.create", { ...body, codeVerifier: "w".repeat(50) }, headers);
  expect(wrong.json.error).toBeTruthy();
  const missing = await trpcCall(page, "session.create", { ...body, codeVerifier: undefined }, headers);
  expect(missing.json.error.data.code).toBe("BAD_REQUEST");
});
