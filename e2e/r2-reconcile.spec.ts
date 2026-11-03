import { execFileSync } from "node:child_process";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";

test("media:reconcile refuses to run under R2_DRY_RUN and leaks no endpoint", () => {
  const endpoint = "https://secret-endpoint.invalid";
  let stderr = "";
  try {
    execFileSync("npm", ["run", "media:reconcile", "--", "--dry-run"], {
      env: { ...process.env, ...E2E_DB_ENV, R2_DRY_RUN: "1", R2_ENDPOINT: endpoint },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (e) {
    stderr = String((e as { stderr?: string }).stderr);
  }
  expect(stderr).toContain("Refusing to reconcile");
  expect(stderr).not.toContain(endpoint);
});
