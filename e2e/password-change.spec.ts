import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInAdmin, STAFF_PASSWORD } from "./support/staff";

// SPEC §9.2 첫 로그인, §9.5 password.update, §10.5 계정 전이 "비밀번호 변경": an account issued with a
// temporary password can do nothing but change it. Afterwards the other sessions of that user end.

test.use({ viewport: { width: 1440, height: 900 } });

const NEW_PASSWORD = "a-brand-new-password";

async function fillChangeForm(page: Page, fields: { current: string; next: string; confirm: string }) {
  await page.getByLabel("Temporary password").fill(fields.current);
  await page.getByLabel("New password", { exact: true }).fill(fields.next);
  await page.getByLabel("Confirm new password").fill(fields.confirm);
}

test("an operator with a temporary password chooses a new one, then reaches Institutions", async ({ page }) => {
  const operator = await seedOperator({ mustChangePassword: true });
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(operator.email);
  await page.getByLabel("Password").fill(operator.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin\/change-password$/);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  await fillChangeForm(page, { current: operator.password, next: "short", confirm: "short" });
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert")).toContainText("at least 12");

  await fillChangeForm(page, { current: operator.password, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/admin\/institutions$/);
  await expect(page.getByRole("heading", { name: "Institutions" })).toBeVisible();
  expect((await adminCall(page, "me.get")).json.result.data).toMatchObject({ mustChangePassword: false });

  // The old password no longer signs in; the new one does.
  await page.context().clearCookies();
  const old = await adminCall(page, "admin.session.create", { email: operator.email, password: operator.password });
  expect(old.status).toBe(401);
  const fresh = await adminCall(page, "admin.session.create", { email: operator.email, password: NEW_PASSWORD });
  expect(fresh.status).toBe(200);
});

test("institution staff with a temporary password choose a new one at /institutions", async ({ page }) => {
  const account = await seedInstitutionAccount({ mustChangePassword: true });
  await page.goto("/institutions/sign-in");
  await page.getByLabel("Institution ID").fill(account.institutionCode);
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/institutions\/change-password$/);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  await fillChangeForm(page, { current: account.password, next: NEW_PASSWORD, confirm: "something-else-entirely" });
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");

  await fillChangeForm(page, { current: account.password, next: NEW_PASSWORD, confirm: NEW_PASSWORD });
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).not.toHaveURL(/change-password/);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toHaveCount(0);
  expect((await consoleCall(page, "me.get")).json.result.data).toMatchObject({ mustChangePassword: false });

  await page.context().clearCookies();
  const credentials = { institutionCode: account.institutionCode, email: account.email };
  expect((await consoleCall(page, "console.session.create", { ...credentials, password: account.password })).status).toBe(401);
  expect((await consoleCall(page, "console.session.create", { ...credentials, password: NEW_PASSWORD })).status).toBe(200);
});

test("password.update refuses weak and wrong passwords and ends the user's other sessions", async ({ page, browser }) => {
  const operator = await seedOperator({ mustChangePassword: true });
  await signInAdmin(page, operator);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signInAdmin(otherPage, operator);
  expect((await adminCall(otherPage, "me.get")).status).toBe(200);

  const tooShort = await adminCall(page, "password.update", { currentPassword: STAFF_PASSWORD, newPassword: "short" });
  expect(tooShort.status).toBe(400);
  expect(tooShort.json.error.data.appCode).toBe("PASSWORD_TOO_WEAK");

  const wrong = await adminCall(page, "password.update", { currentPassword: "not-the-password", newPassword: NEW_PASSWORD });
  expect(wrong.status).toBe(400);
  expect(wrong.json.error.data.appCode).toBeUndefined();
  // Nothing changed: still a temporary password, both sessions alive.
  expect((await adminCall(page, "me.get")).json.result.data.mustChangePassword).toBe(true);
  expect((await adminCall(otherPage, "me.get")).status).toBe(200);

  const ok = await adminCall(page, "password.update", { currentPassword: STAFF_PASSWORD, newPassword: NEW_PASSWORD });
  expect(ok.status).toBe(200);
  expect((await adminCall(page, "me.get")).json.result.data.mustChangePassword).toBe(false);
  expect((await adminCall(otherPage, "me.get")).status).toBe(401);
  const [row] = await e2eSql<{ password_hash: string }>("SELECT password_hash FROM user_tokens WHERE user_id = $1", [operator.userId]);
  expect(row.password_hash).toMatch(/^\$argon2id\$/);
  await other.close();
});

test("a visitor session cannot use password.update", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const res = await trpcCall(page, "password.update", { currentPassword: "whatever-it-is", newPassword: NEW_PASSWORD });
  expect(res.status).toBe(403);
});
