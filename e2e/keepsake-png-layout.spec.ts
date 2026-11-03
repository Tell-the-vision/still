import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";
const cover = readFileSync("e2e/fixtures/cover.png");
const webpCover = readFileSync("e2e/fixtures/cover.webp");
let coverless = 0; // set by the fallback test; the tests run serially
test.describe.configure({ mode: "serial" });

test("a Korean reflection card downloads as a full-size PNG without fetching fonts", async ({ page, next }) => {
  const fetched: string[] = [];
  next.onFetch((request) => {
    fetched.push(request.url);
    return "abort";
  });
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await trpcCall(page, "journal.upsert", { code, content: "고요한 빛 Quiet light.", audioType: null, revision: null });
  await trpcCall(page, "keepsake.upsert", { code, templateId: "reflection", journalExcerpt: "고요한 빛 Quiet light." });
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  // The guide already holds the card as it was; reload so the detail reads the one just saved.
  await page.reload();

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG" }).click();
  const png = await readFile(await (await downloading).path());
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1440]);
  expect(png.length).toBeGreaterThan(10_000);
  expect(fetched.filter((url) => /font|\.ttf|gstatic/i.test(url))).toEqual([]);
});

async function downloadWithCoverCard(page: Page, next: Parameters<typeof stubGoogleToken>[0]) {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "with-cover");
  // This exhibition has no guide sentences, so a journal creates the archive.
  await trpcCall(page, "journal.upsert", { code: "with-cover", content: "Quiet light.", audioType: null, revision: null });
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "With Cover", exact: true }).click();
  await page.getByRole("link", { name: "Create web card" }).click();
  await page.getByRole("radio", { name: "Cover" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/with-cover$/);
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG" }).click();
  return readFile(await (await downloading).path());
}

test("a cover that cannot be fetched falls back to the no-image PNG", async ({ page, next }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  const fallback = await downloadWithCoverCard(page, next);
  expect(fallback.readUInt32BE(16)).toBe(1080);
  expect(fallback.length).toBeGreaterThan(10_000);
  coverless = fallback.length;
});

test("a fetched cover is drawn into the PNG", async ({ page, next }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  next.onFetch((request) => (request.url.startsWith("https://media.test.invalid/") ? new Response(cover) : undefined));
  const png = await downloadWithCoverCard(page, next);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.length).not.toBe(coverless);
});

// Covers may be WebP (seed import allows it); the PNG renderer only decodes PNG and JPEG.
test("a WebP cover is drawn into the PNG", async ({ page, next }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.webp" }));
  next.onFetch((request) =>
    request.url.startsWith("https://media.test.invalid/") ? new Response(webpCover, { headers: { "content-type": "image/webp" } }) : undefined,
  );
  const png = await downloadWithCoverCard(page, next);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.length).not.toBe(coverless);
});
