import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// SPEC §9.2 기관 정지·재개, §9.5, §10.5: the operator suspends or reactivates an institution from the
// A9 row menu (admin.institution.update). Suspending ends every staff session of that institution.

test.use({ viewport: { width: 1440, height: 900 } });

const WRONG = "Institution ID, email or password is incorrect.";
const sessionCount = async (institutionId: string) =>
  Number((await e2eSql<{ n: string }>("SELECT count(*) AS n FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE u.institution_id = $1", [institutionId]))[0].n);

test("suspending signs the institution's staff out at once and reactivating lets them back in", async ({ page, browser }) => {
  const account = await seedInstitutionAccount();
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await signInConsole(staffPage, account);
  expect((await consoleCall(staffPage, "me.get")).status).toBe(200);
  expect(await sessionCount(account.institutionId)).toBe(1);

  await signInAdmin(page, await seedOperator());
  await page.goto("/admin/institutions");
  // Other tests add institutions at the same time: find this one by its ID.
  await page.getByPlaceholder("Search institution name or ID").fill(account.institutionCode);
  const row = page.getByRole("row").filter({ hasText: account.institutionCode });
  await page.getByRole("button", { name: `Actions for ${account.institutionName}` }).click();
  await page.getByRole("menuitem", { name: "Suspend access…" }).click();
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(row.getByText("Suspended", { exact: true })).toBeVisible();

  expect((await consoleCall(staffPage, "me.get")).status).toBe(401);
  expect(await sessionCount(account.institutionId)).toBe(0);
  const refused = await consoleCall(staffPage, "console.session.create", { institutionCode: account.institutionCode, email: account.email, password: account.password });
  expect(refused.status).toBe(401);
  expect(refused.json.error.message).toBe(WRONG);

  await page.getByRole("button", { name: `Actions for ${account.institutionName}` }).click();
  await page.getByRole("menuitem", { name: "Reactivate access" }).click();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
  await signInConsole(staffPage, account);
  expect((await consoleCall(staffPage, "me.get")).status).toBe(200);
  await staff.close();
});

test("name and the daily token limit update, and null resets the limit", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());
  const update = async (input: object) => (await adminCall(page, "admin.institution.update", { id: account.institutionId, ...input })).json.result.data;

  expect(await update({ name: "  Renamed Museum  ", analysisDailyTokenLimit: 5000 })).toMatchObject({ name: "Renamed Museum", analysisDailyTokenLimit: 5000, status: "ACTIVE" });
  // Fields left out stay as they are.
  expect(await update({ name: "Renamed Again" })).toMatchObject({ name: "Renamed Again", analysisDailyTokenLimit: 5000 });
  expect(await update({ analysisDailyTokenLimit: null })).toMatchObject({ analysisDailyTokenLimit: null });
  // Renaming does not end sessions.
  expect(await update({})).toMatchObject({ name: "Renamed Again" });
});

test("an unknown institution is NOT_FOUND and a console session cannot call update", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());
  const missing = await adminCall(page, "admin.institution.update", { id: randomUUID(), status: "SUSPENDED" });
  expect(missing.status).toBe(404);
  expect(missing.json.error.data.code).toBe("NOT_FOUND");

  const staff = await page.context().browser()!.newContext();
  const staffPage = await staff.newPage();
  await signInConsole(staffPage, account);
  const denied = await adminCall(staffPage, "admin.institution.update", { id: account.institutionId, status: "SUSPENDED" });
  expect(denied.status).toBe(401);
  await staff.close();
  expect((await e2eSql<{ status: string }>("SELECT status FROM institutions WHERE id = $1", [account.institutionId]))[0].status).toBe("ACTIVE");
});
