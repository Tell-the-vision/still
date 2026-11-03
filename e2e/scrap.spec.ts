import type { Route } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved sentence stays saved after reload and can no longer be pressed", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Kept" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
});

test("a guest is asked to log in", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("button", { name: "Keep this line" }).first()).toBeVisible();
});

test("a failed save shows Retry and a retry saves it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  const failing = (route: Route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify([{ error: { message: "boom", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } } }]),
    });
  await page.route(/scrap\.upsert/, failing);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByText("Couldn't keep this line.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(0);
  await page.unroute(/scrap\.upsert/, failing);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
});

test("saving is idempotent, concurrent-safe and rejects another exhibition's sentence", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const sentence = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const save = (sentenceId: string, code = "forms-of-stillness") => trpcCall(page, "scrap.upsert", { code, sentenceId });
  expect((await save(sentence(3))).status).toBe(404);
  expect((await save(sentence(1))).json.result.data.created).toBe(true);
  expect((await save(sentence(1))).json.result.data.created).toBe(false);
  const both = await Promise.all([save(sentence(2)), save(sentence(2))]);
  expect(both.map((r) => r.json.result.data.created).sort()).toEqual([false, true]);
  const list = (await trpcCall(page, "scrap.list", { code: "forms-of-stillness" })).json.result.data;
  expect(list.map((s: { sentenceId: string }) => s.sentenceId).sort()).toEqual([sentence(1), sentence(2)]);
});
