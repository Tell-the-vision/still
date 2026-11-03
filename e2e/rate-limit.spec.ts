import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("the auth route answers 429 past the per-IP limit, per address", async ({ page, request }) => {
  await page.goto("/");
  const url = "/api/auth/google?intent=sign_in&returnTo=/";
  const get = (ip: string) => request.get(url, { headers: { "x-forwarded-for": ip }, maxRedirects: 0 });
  let last = 0;
  for (let sent = 0; sent < 2001; sent += 100) {
    const batch = await Promise.all(Array.from({ length: Math.min(100, 2001 - sent) }, () => get("10.9.9.9")));
    last = batch[batch.length - 1].status();
  }
  expect(last).toBe(429);
  expect((await get("10.8.8.8")).status()).toBe(302);
});

test("a body over 100 KB is refused with 413", async ({ page }) => {
  await page.goto("/");
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/trpc/me.get", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filler: "x".repeat(200 * 1024) }),
    });
    return res.status;
  });
  expect(status).toBe(413);
});

test("a signed-in user past the per-user limit gets 429 on me.get and on personal procedures", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  const post = (procedure: string) =>
    page.evaluate(async (name) => (await fetch(`/api/trpc/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, procedure);
  const statuses: number[] = [];
  for (let i = 0; i < 301; i++) statuses.push(await post("me.get"));
  expect(statuses[0]).toBe(200);
  expect(statuses).toContain(429);
  expect(await post("scrap.list")).toBe(429);
});

test("the guide ends with the journal link below the last rule", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const link = page.getByRole("link", { name: /Write a journal|Your journal/ });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
});
