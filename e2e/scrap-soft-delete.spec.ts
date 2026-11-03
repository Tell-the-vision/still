import { execFileSync } from "node:child_process";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved sentence survives the exhibition re-import that removes it", async ({ page, next, browser, baseURL }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "soft-delete");
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);

  execFileSync("npm", ["run", "db:seed", "--", "e2e/fixtures/pkg-soft-delete-v2.ts"], {
    env: { ...process.env, ...E2E_DB_ENV },
    encoding: "utf8",
  });

  // A new context avoids the max-age=60 browser cache of the earlier guide response.
  const fresh = await browser.newContext({ baseURL });
  const freshPage = await fresh.newPage();
  await openGuide(freshPage, "soft-delete");
  await expect(freshPage.getByText("This line stays.")).toBeVisible();
  await expect(freshPage.getByText("This line will be removed.")).toHaveCount(0);
  await fresh.close();

  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Soft Delete" }).click();
  await expect(page.getByRole("heading", { name: "01 saved guide sentence" })).toBeVisible();
  await expect(page.getByText("This line will be removed.")).toBeVisible();
});
