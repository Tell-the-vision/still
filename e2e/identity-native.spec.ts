import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, stubGoogleToken } from "./support/google";

const native = { "x-client": "ios", "x-client-version": "1.0.0" };
const body = (redirectUri = "still:///oauthredirect") => ({ provider: "GOOGLE", code: "test", codeVerifier: "v", redirectUri });

test("identity.create links a second sub idempotently and rejects one owned by another user", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await page.goto("/");
  const first = await trpcCall(page, "session.create", body(), native);
  const headers = { ...native, authorization: `Bearer ${first.json.result.data.accessToken}` };

  const linked = newUser();
  Object.assign(user, linked);
  expect((await trpcCall(page, "identity.create", body(), headers)).json.result.data.created).toBe(true);
  expect((await trpcCall(page, "identity.create", body(), headers)).json.result.data.created).toBe(false);

  Object.assign(user, newUser());
  const other = await trpcCall(page, "session.create", body(), native);
  Object.assign(user, linked);
  const conflict = await trpcCall(page, "identity.create", body(), { ...native, authorization: `Bearer ${other.json.result.data.accessToken}` });
  expect([conflict.status, conflict.json.error.data.appCode]).toEqual([409, "IDENTITY_ALREADY_LINKED"]);

  expect((await trpcCall(page, "identity.create", body("https://evil.example/cb"), headers)).status).toBe(400);
});
