import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("opening a guide creates the archive once, then only refreshes it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const first = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  expect((await (await first).json())[0].result.data.created).toBe(true);
  let upserts = 0;
  page.on("request", (request) => request.url().includes("archive.upsert") && upserts++);
  const second = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  expect((await (await second).json())[0].result.data.created).toBe(false);
  expect(upserts).toBe(1);
});

test("a draft exhibition cannot be archived", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const headers = { origin: new URL(page.url()).origin };
  const res = await page.request.post("/api/trpc/archive.upsert", { headers, data: { code: "draft-preview" } });
  expect(res.status()).toBe(404);
});

test("a guest guide sends no archive.upsert", async ({ page }) => {
  let upserts = 0;
  page.on("request", (request) => request.url().includes("archive.upsert") && upserts++);
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("A room can hold its breath.")).toBeVisible();
  expect(upserts).toBe(0);
});
