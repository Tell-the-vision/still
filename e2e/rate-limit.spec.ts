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

test("a signed-in reader stays signed in on the guide after hammering the API", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  const statuses = await page.evaluate(async () => {
    const out: number[] = [];
    for (let i = 0; i < 150; i++) out.push((await fetch("/api/trpc/me.get", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status);
    return out;
  });
  expect([...new Set(statuses)]).toEqual([200]);
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("button", { name: "Keep this line" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page).not.toHaveURL(/login/);
});

test("the guide ends with the journal link below the last rule", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const link = page.getByRole("link", { name: /Write a journal|Your journal/ });
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
});
