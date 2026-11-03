import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

// Calls the API from Home as an app of the given version (SPEC §11.2).
async function callAs(page: Page, path: string, version: string, body: unknown = {}) {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    async ({ path, version, body }) => {
      const res = await fetch(`/api/trpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-client": "ios", "x-client-version": version },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json() };
    },
    { path, version, body },
  );
}

test("an app below the minimum version is refused on personal calls", async ({ page }) => {
  for (const [path, body] of [["me.get", {}], ["session.refresh", { refreshToken: "x" }]] as const) {
    const old = await callAs(page, path, "0.1.0", body);
    expect([old.status, old.json.error.data.appCode]).toEqual([412, "CLIENT_UPGRADE_REQUIRED"]);
    expect((await callAs(page, path, "0.5.0", body)).status).not.toBe(412);
  }
});

test("web sign-in is never version-checked", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Please update STILL to continue.")).toHaveCount(0);
});
