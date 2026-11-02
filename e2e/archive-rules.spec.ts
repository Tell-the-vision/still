import { execFileSync } from "node:child_process";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test.describe.configure({ mode: "serial" });

test("an archive of an unpublished exhibition stays readable but cannot be created", async ({ page, next, browser, baseURL }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "status-flip");
  await upserted;

  execFileSync("npm", ["run", "db:seed", "--", "e2e/fixtures/pkg-status-flip-draft.ts"], {
    env: { ...process.env, ...E2E_DB_ENV },
    encoding: "utf8",
  });

  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Status Flip" }).click();
  await expect(page.getByText("Status Flip", { exact: true }).last()).toBeVisible();

  // A new context avoids the max-age=60 browser cache of the earlier guide response.
  const fresh = await browser.newContext({ baseURL });
  const freshPage = await fresh.newPage();
  await openGuide(freshPage, "status-flip");
  await expect(freshPage.getByText("This exhibition isn't available.")).toBeVisible();
  await fresh.close();

  expect((await trpcCall(page, "archive.upsert", { code: "status-flip" })).status).toBe(404);
  expect((await trpcCall(page, "archive.get", { code: "status-flip" })).json.result.data).not.toBeNull();
});

test("two concurrent visits create one archive", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const calls = await Promise.all([1, 2].map(() => trpcCall(page, "archive.upsert", { code: "quiet-rooms" })));
  expect(calls.map((call) => call.json.result.data.created).sort()).toEqual([false, true]);
});
