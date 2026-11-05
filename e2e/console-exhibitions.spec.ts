import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { adminCall, consoleCall, seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// SPEC §9.4 목록 (Figma A8), §9.5 console.exhibition.list / get: an institution's staff see their
// own exhibitions only; another institution's code is NOT_FOUND.

test.use({ viewport: { width: 1440, height: 900 } });

test("staff sign in, land on their workspace and see only their institution's exhibitions", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const draft = await seedExhibition(account, { title: "Forms of Light" });
  const live = await seedExhibition(account, { title: "Quiet Matter", state: "PUBLISHED" });
  const other = await seedExhibition(await seedInstitutionAccount(), { title: "Not Ours" });

  await page.goto("/console/sign-in");
  await page.getByLabel("Institution ID").fill(account.institutionCode);
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/console\/overview$/);

  await page.getByRole("link", { name: "Published exhibitions" }).click();
  await expect(page.getByText(draft.title, { exact: true })).toBeVisible();
  await expect(page.getByText(live.title, { exact: true })).toBeVisible();
  await expect(page.getByText(other.title, { exact: true })).toHaveCount(0);
});

test("console.exhibition.list pages by cursor and filters by state and text", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const first = await seedExhibition(account, { title: "Alpha Rooms" });
  const second = await seedExhibition(account, { title: "Beta Rooms", state: "UNPUBLISHED" });
  await signInConsole(page, account);

  const page1 = (await consoleCall(page, "console.exhibition.list", { limit: 1 })).json.result.data;
  expect(page1).toMatchObject({ totalSize: 2, items: [{ code: second.code }] });
  const page2 = (await consoleCall(page, "console.exhibition.list", { limit: 1, cursor: page1.nextCursor })).json.result.data;
  expect(page2).toMatchObject({ nextCursor: null, items: [{ code: first.code, state: "DRAFT", displayStatus: "DRAFT" }] });

  const unpublished = (await consoleCall(page, "console.exhibition.list", { state: "UNPUBLISHED" })).json.result.data;
  expect(unpublished.items.map((e: { code: string }) => e.code)).toEqual([second.code]);
  const byText = (await consoleCall(page, "console.exhibition.list", { q: "alpha" })).json.result.data;
  expect(byText.items.map((e: { code: string }) => e.code)).toEqual([first.code]);
});

test("console.exhibition.get returns the draft and counts, and hides other institutions' codes", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const live = await seedExhibition(account, { title: "Tidal", state: "PUBLISHED", startDate: "2026-01-01", endDate: "2030-12-31" });
  const other = await seedExhibition(await seedInstitutionAccount());
  await signInConsole(page, account);

  const got = await consoleCall(page, "console.exhibition.get", { code: live.code });
  expect(got.json.result.data).toMatchObject({
    code: live.code,
    state: "PUBLISHED",
    displayStatus: "LIVE",
    title: "Tidal",
    hasUnpublishedChanges: false,
    draft: { version: 1, title: "Tidal" },
    counts: { documents: 0, contents: { ready: 0, needsReview: 0, approved: 0, rejected: 0 } },
  });
  expect((await consoleCall(page, "console.exhibition.get", { code: other.code })).status).toBe(404);
  expect((await consoleCall(page, "console.exhibition.get", { code: "no-such-exhibition" })).status).toBe(404);
});

test("operators cannot read console exhibitions", async ({ page }) => {
  await signInAdmin(page, await seedOperator());
  expect((await adminCall(page, "console.exhibition.list", {})).status).toBe(401);
});
