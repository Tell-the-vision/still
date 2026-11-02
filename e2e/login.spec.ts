import { expect, test } from "next/experimental/testmode/playwright";
import { captureAuthorize } from "./support/google";

test("Home -> Login -> Continue with Google starts OAuth with PKCE and an HttpOnly state cookie", async ({ page }) => {
  const captured = await captureAuthorize(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => captured.location).not.toBe("");

  const url = new URL(captured.location);
  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(url.searchParams.get("client_id")).toBe("test-google-web-id");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("redirect_uri")).toBe(`${new URL(page.url()).origin}/api/auth/google/callback`);
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(captured.setCookie).toMatch(/^still_oauth=.*HttpOnly/);
});

test("the start route rejects unknown providers and non sign_in intents", async ({ request }) => {
  expect((await request.get("/api/auth/github?intent=sign_in", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/api/auth/google?intent=link", { maxRedirects: 0 })).status()).toBe(400);
});
