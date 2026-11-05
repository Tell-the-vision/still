import { expect, test } from "next/experimental/testmode/playwright";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// SPEC §9.2, §9.5, §10.5: operators list, suspend, reactivate, rename, delete and reset the password
// of staff accounts. LAST_ADMIN needs an empty database and is checked outside this shared one.

test.use({ viewport: { width: 1440, height: 900 } });

type Reply = { json: { result: { data: any } } }; // eslint-disable-line @typescript-eslint/no-explicit-any
const data = (res: Reply) => res.json.result.data;

test("the operator resets a workspace admin's password from the institution row", async ({ page, browser }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());

  // The institution list is built in a parallel change (#46): serve the row the A9 table needs.
  await page.route("**/api/trpc/admin.institution.list", (route) =>
    route.fulfill({
      json: {
        result: {
          data: [{
            id: staff.institutionId, code: staff.institutionCode, name: staff.institutionName, status: "ACTIVE", displayStatus: "ACTIVE",
            accountCount: 1, workspaceAdmin: { accountId: staff.userId, email: staff.email }, lastActiveAt: null,
            analysisDailyTokenLimit: null, createdAt: new Date().toISOString(),
          }],
        },
      },
    }),
  );

  // The staff member is signed in elsewhere.
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await signInConsole(staffPage, staff);
  expect((await consoleCall(staffPage, "me.get")).status).toBe(200);

  await page.goto("/admin/institutions");
  await page.getByRole("button", { name: `Actions for ${staff.institutionName}` }).click();
  await page.getByRole("menuitem", { name: "Reset password" }).click();
  await page.getByRole("button", { name: "Reset password", exact: true }).click();

  const notice = page.getByRole("status").filter({ hasText: "Temporary password" });
  await expect(notice).toContainText(staff.email);
  await expect(notice).toContainText("shown only once");
  const password = (await notice.locator("code").textContent())!;
  expect(password).toMatch(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/);
  await expect(notice.getByRole("button", { name: "Copy" })).toBeVisible();

  // The new password signs in and must be changed; the old one does not; the open session is gone.
  const attempt = (pw: string) =>
    consoleCall(page, "console.session.create", { institutionCode: staff.institutionCode, email: staff.email, password: pw, remember: false });
  expect((await attempt(staff.password)).status).toBe(401);
  const signedIn = await attempt(password);
  expect(signedIn.status).toBe(200);
  expect(data(signedIn)).toMatchObject({ mustChangePassword: true });
  expect((await consoleCall(staffPage, "me.get")).status).toBe(401);
  await staffContext.close();
});

test("operators list accounts by institution and role", async ({ page }) => {
  const staff = await seedInstitutionAccount();
  const operator = await seedOperator();
  await signInAdmin(page, operator);

  const byInstitution = await adminCall(page, "admin.account.list", { institutionId: staff.institutionId });
  expect(data(byInstitution)).toEqual([
    expect.objectContaining({
      id: staff.userId, role: "INSTITUTION", email: staff.email, status: "ACTIVE", mustChangePassword: false,
      institution: { id: staff.institutionId, code: staff.institutionCode, name: staff.institutionName },
    }),
  ]);
  expect(JSON.stringify(data(byInstitution))).not.toMatch(/hash/i);

  const admins = data(await adminCall(page, "admin.account.list", { role: "ADMIN" }));
  expect(admins.map((a: { id: string }) => a.id)).toContain(operator.userId);
  expect(admins.every((a: { role: string }) => a.role === "ADMIN")).toBe(true);
});

test("suspending ends the sessions and refuses sign-in until the account is reactivated", async ({ page, browser }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await signInConsole(staffPage, staff);

  const suspended = await adminCall(page, "admin.account.update", { id: staff.userId, status: "SUSPENDED" });
  expect(data(suspended)).toMatchObject({ account: { id: staff.userId, status: "SUSPENDED" }, temporaryPassword: null });
  expect((await consoleCall(staffPage, "me.get")).status).toBe(401);
  const signIn = () =>
    consoleCall(staffPage, "console.session.create", { institutionCode: staff.institutionCode, email: staff.email, password: staff.password, remember: false });
  expect((await signIn()).status).toBe(401);

  const active = await adminCall(page, "admin.account.update", { id: staff.userId, status: "ACTIVE" });
  expect(data(active).account.status).toBe("ACTIVE");
  expect((await signIn()).status).toBe(200);
  await staffContext.close();
});

test("an operator renames an account and can reset its password through the API", async ({ page }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());

  const renamed = await adminCall(page, "admin.account.update", { id: staff.userId, displayName: "Kim Curator" });
  expect(data(renamed)).toMatchObject({ account: { displayName: "Kim Curator" }, temporaryPassword: null });

  const reset = data(await adminCall(page, "admin.account.update", { id: staff.userId, resetPassword: true }));
  expect(reset.account.mustChangePassword).toBe(true);
  expect(reset.temporaryPassword).toEqual(expect.any(String));
  const [row] = await e2eSql("SELECT failed_login_count, locked_until FROM user_tokens WHERE user_id = $1", [staff.userId]);
  expect(row).toEqual({ failed_login_count: 0, locked_until: null });
});

test("unknown ids and visitors are not found", async ({ page }) => {
  await signInAdmin(page, await seedOperator());
  // Staff exist for this call, so a 404 below means "not a staff account", not a missing procedure.
  const staff = await seedInstitutionAccount();
  expect((await adminCall(page, "admin.account.update", { id: staff.userId, displayName: "Exists" })).status).toBe(200);
  const [visitor] = await e2eSql<{ id: string }>("INSERT INTO users (role, status) VALUES ('VISITOR', 'ACTIVE') RETURNING id");
  for (const id of ["00000000-0000-4000-8000-000000000000", visitor.id]) {
    expect((await adminCall(page, "admin.account.update", { id, status: "SUSPENDED" })).status).toBe(404);
    expect((await adminCall(page, "admin.account.delete", { id })).status).toBe(404);
  }
});

test("deleting an account removes the row and refuses its sign-in", async ({ page }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());

  expect((await adminCall(page, "admin.account.delete", { id: staff.userId })).status).toBe(200);
  expect(data(await adminCall(page, "admin.account.list", { institutionId: staff.institutionId }))).toEqual([]);
  const res = await consoleCall(page, "console.session.create", {
    institutionCode: staff.institutionCode, email: staff.email, password: staff.password, remember: false,
  });
  expect(res.status).toBe(401);
});
