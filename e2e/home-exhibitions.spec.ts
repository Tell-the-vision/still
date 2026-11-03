import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

async function signedInHome(page: Parameters<typeof signIn>[0], next: Parameters<typeof stubGoogleToken>[0]) {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
}

test("Home lists exhibitions on view, not drafts or past ones", async ({ page, next }) => {
  await signedInHome(page, next);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Forms of Stillness/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Quiet Rooms/ })).toBeVisible();
  await expect(page.getByText("Draft Preview")).toHaveCount(0);
  await expect(page.getByText("Past Light")).toHaveCount(0);
  await expect(page.getByText("YOUR ARCHIVE")).toHaveCount(0);
});

test("ALL shows more exhibitions and the choice survives a reload", async ({ page, next }) => {
  await signedInHome(page, next);
  const group = page.getByRole("radiogroup", { name: "Show exhibitions" });
  await group.getByRole("button", { name: "ALL" }).click();
  await expect(page.getByRole("link", { name: /Ended · Busan Gallery/ })).toBeVisible();
  await expect(page.getByText("Draft Preview")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: /Ended · Busan Gallery/ })).toBeVisible();
});

test("tapping an exhibition opens its guide", async ({ page, next }) => {
  await signedInHome(page, next);
  await page.getByRole("link", { name: /Quiet Rooms/ }).click();
  await expect(page).toHaveURL(/\/e\/quiet-rooms$/);
});

test("exhibition.list is public, cacheable and filtered by scope", async ({ request }) => {
  const get = (input: object) => request.get(`/api/trpc/exhibition.list?input=${encodeURIComponent(JSON.stringify(input))}`);
  const onView = await get({});
  expect(onView.headers()["cache-control"]).toContain("public");
  const codes = (await onView.json()).result.data.items.map((i: { code: string }) => i.code);
  expect(codes).toContain("forms-of-stillness");
  expect(codes).not.toContain("past-light");
  expect(codes).not.toContain("draft-preview");
  const all = (await (await get({ scope: "ALL" })).json()).result.data.items;
  expect(all.find((i: { code: string }) => i.code === "past-light").availability).toBe("ENDED");
  expect(all.map((i: { code: string }) => i.code)).not.toContain("draft-preview");
});
