import { execFileSync } from "node:child_process";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";
import { openGuide } from "./support/reach";

for (const name of ["bad-code", "duplicate-sentence", "wrong-playlist-domain"]) {
  test(`import rejects invalid package: ${name}`, async ({ page }) => {
    expect(() =>
      execFileSync("npm", ["run", "db:seed", "--", `e2e/fixtures/invalid-${name}.ts`], {
        env: { ...process.env, ...E2E_DB_ENV },
        stdio: "pipe",
      }),
    ).toThrow();

    await openGuide(page, "forms-of-stillness");
    await expect(page).toHaveURL(/\/e\/forms-of-stillness/);
  });
}
