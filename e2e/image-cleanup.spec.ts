import { execFileSync } from "node:child_process";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";
import { openGuide } from "./support/reach";

const reimport = () =>
  execFileSync("npm", ["run", "db:seed", "--", "e2e/fixtures/pkg-image-cleanup-v2.ts"], {
    env: { ...process.env, ...E2E_DB_ENV, R2_DRY_RUN: "1" },
    encoding: "utf8",
  });

test("re-import deletes the image no longer referenced, once", async ({ page }) => {
  expect(reimport()).toContain("deleted 1 image row");
  expect(reimport()).toContain("deleted 0 image row");

  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  await openGuide(page, "image-cleanup");
  await expect(page.getByRole("img", { name: "Cleanup cover" }).first()).toBeVisible();
  await expect(page.getByLabel("Detail")).toHaveCount(0);
});
