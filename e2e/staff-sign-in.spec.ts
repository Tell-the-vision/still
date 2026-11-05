import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { E2E_DB_ENV } from "../playwright.config";
import { trpcCall } from "./support/api";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.2, §10.5: institution staff sign in with institution ID + work email + password at
// /institutions (Figma A10), STILL operators with email + password at /admin. Each app has its own
// session cookie, and every request re-checks the account.

test.use({ viewport: { width: 1440, height: 900 } });

const WRONG = "Institution ID, email or password is incorrect.";

async function fillConsoleSignIn(page: Page, fields: { institutionId: string; email: string; password: string }) {
  await page.getByLabel("Institution ID").fill(fields.institutionId);
  await page.getByLabel("Work email").fill(fields.email);
  await page.getByLabel("Password").fill(fields.password);
}

const cookie = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name);

test("institution staff sign in with the institution ID, work email and password", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await page.goto("/institutions/sign-in");
  // The ID and the email are not case-sensitive.
  await fillConsoleSignIn(page, { institutionId: account.institutionCode.toLowerCase(), email: account.email.toUpperCase(), password: account.password });
  const signedIn = page.waitForResponse(/console\.session\.create/);
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await signedIn).status()).toBe(200);
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Without "Remember this device" the cookie ends with the browser.
  expect(await cookie(page, "still_console_session")).toMatchObject({ httpOnly: true, sameSite: "Lax", expires: -1 });
  const me = await consoleCall(page, "me.get");
  expect(me.json.result.data).toMatchObject({
    email: account.email,
    role: "INSTITUTION",
    institution: { code: account.institutionCode, name: account.institutionName },
    mustChangePassword: false,
  });
});

test("Remember this device keeps the console session for 30 days", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await page.goto("/institutions/sign-in");
  await fillConsoleSignIn(page, { institutionId: account.institutionCode, email: account.email, password: account.password });
  await page.getByLabel("Remember this device").check();
  const signedIn = page.waitForResponse(/console\.session\.create/);
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await signedIn).status()).toBe(200);
  const expires = (await cookie(page, "still_console_session"))!.expires * 1000;
  expect(expires - Date.now()).toBeGreaterThan(29 * 24 * 3600 * 1000);
});

test("a wrong institution ID, a wrong password and an unknown email all get the same message", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const other = await seedInstitutionAccount();
  await page.goto("/institutions/sign-in");
  for (const attempt of [
    { institutionId: other.institutionCode, email: account.email, password: account.password },
    { institutionId: account.institutionCode, email: account.email, password: "not-the-password" },
    { institutionId: account.institutionCode, email: `nobody-${randomUUID()}@museum.test`, password: account.password },
  ]) {
    await fillConsoleSignIn(page, attempt);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText(WRONG);
  }
  expect(await cookie(page, "still_console_session")).toBeUndefined();
});

test("ten wrong passwords lock the account for 15 minutes", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await page.goto("/institutions/sign-in");
  const attempt = (password: string) =>
    consoleCall(page, "console.session.create", { institutionCode: account.institutionCode, email: account.email, password });
  for (let i = 0; i < 10; i++) expect((await attempt("not-the-password")).status).toBe(401);

  // Locked: even the right password gets the same answer.
  const locked = await attempt(account.password);
  expect(locked.status).toBe(401);
  expect(locked.json.error.message).toBe(WRONG);
  const [row] = await e2eSql<{ minutes: number }>(
    "SELECT round(extract(epoch FROM locked_until - now()) / 60) AS minutes FROM user_tokens WHERE subject = $1",
    [account.email],
  );
  expect(Number(row.minutes)).toBe(15);

  // Once the lock has passed, the right password works and clears the count.
  await e2eSql("UPDATE user_tokens SET locked_until = now() - interval '1 second' WHERE subject = $1", [account.email]);
  expect((await attempt(account.password)).status).toBe(200);
  const [after] = await e2eSql<{ failed_login_count: number; last_login_at: Date | null }>(
    "SELECT failed_login_count, last_login_at FROM user_tokens WHERE subject = $1",
    [account.email],
  );
  expect(after).toMatchObject({ failed_login_count: 0, last_login_at: expect.any(Date) });
});

test("operators sign in at /admin with email and password", async ({ page }) => {
  const operator = await seedOperator();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(operator.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.");

  await page.getByLabel("Password").fill(operator.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/institutions$/);
  await expect(page.getByRole("heading", { name: "Institutions" })).toBeVisible();
  expect(await cookie(page, "still_admin_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("npm run admin:create issues the first operator with a temporary password", async ({ page }) => {
  const email = `ops-${randomUUID().slice(0, 8)}@still.test`;
  const out = execFileSync("npm", ["run", "admin:create", "--", "--email", email, "--name", "First Operator"], {
    env: { ...process.env, ...E2E_DB_ENV },
    encoding: "utf8",
  });
  const password = /Temporary password: (\S+)/.exec(out)?.[1] ?? "";
  // Only the argon2id hash is stored (SPEC §9.7).
  const [stored] = await e2eSql<{ password_hash: string }>("SELECT password_hash FROM user_tokens WHERE subject = $1", [email]);
  expect(stored.password_hash).toMatch(/^\$argon2id\$/);
  expect(stored.password_hash).not.toContain(password);

  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // A temporary password leads to the change screen first (e2e/password-change.spec.ts).
  await expect(page).toHaveURL(/\/admin\/change-password$/);
  expect((await adminCall(page, "me.get")).json.result.data).toMatchObject({ email, role: "ADMIN", displayName: "First Operator", mustChangePassword: true });
});

test("each app reads only its own session, and a session never serves another role", async ({ page, context }) => {
  const account = await seedInstitutionAccount();
  await signInConsole(page, account);
  expect((await consoleCall(page, "me.get")).status).toBe(200);
  // The admin app and the visitor app see no session of theirs.
  expect((await adminCall(page, "me.get")).status).toBe(401);
  expect((await trpcCall(page, "me.get", null)).status).toBe(401);
  expect((await trpcCall(page, "archive.list", {})).status).toBe(401);

  // A console token carried in the admin or visitor cookie is refused for its role.
  const token = (await cookie(page, "still_console_session"))!.value;
  const where = { domain: new URL(page.url()).hostname, path: "/" };
  await context.addCookies([
    { name: "still_admin_session", value: token, ...where },
    { name: "still_session", value: token, ...where },
  ]);
  expect((await adminCall(page, "me.get")).status).toBe(403);
  expect((await trpcCall(page, "me.get", null)).status).toBe(403);

  // Signing out of the console ends the console session.
  expect((await consoleCall(page, "session.delete")).status).toBe(200);
  expect((await consoleCall(page, "me.get")).status).toBe(401);
});

test("suspending the institution stops its staff on the next request", async ({ page }) => {
  const account: InstitutionAccount = await seedInstitutionAccount();
  await signInConsole(page, account);
  expect((await consoleCall(page, "me.get")).status).toBe(200);

  await e2eSql("UPDATE institutions SET status = 'SUSPENDED' WHERE id = $1", [account.institutionId]);
  expect((await consoleCall(page, "me.get")).status).toBe(401);
  const again = await consoleCall(page, "console.session.create", { institutionCode: account.institutionCode, email: account.email, password: account.password });
  expect(again.status).toBe(401);
  expect(again.json.error.message).toBe(WRONG);
});
