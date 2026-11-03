import { expect, test } from "next/experimental/testmode/playwright";

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
