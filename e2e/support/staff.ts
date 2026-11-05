import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { Pool } from "pg";
import { E2E_DB_ENV } from "../../playwright.config";
import { hashPassword } from "../../src/server/auth/password";
import { trpcCall } from "./api";

export const STAFF_PASSWORD = "e2e-staff-password";

export type StaffAccount = { userId: string; email: string; password: string };
export type InstitutionAccount = StaffAccount & { institutionId: string; institutionCode: string; institutionName: string };

// Direct SQL against the e2e database, for test setup and for checking stored state.
export async function e2eSql<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const pool = new Pool({ connectionString: E2E_DB_ENV.DATABASE_URL });
  try {
    return (await pool.query(text, values)).rows as T[];
  } finally {
    await pool.end();
  }
}

const tag = () => randomUUID().slice(0, 8);

async function insertAccount(role: "INSTITUTION" | "ADMIN", institutionId: string | null, email: string, mustChangePassword: boolean) {
  const [user] = await e2eSql<{ id: string }>(
    "INSERT INTO users (role, institution_id, status) VALUES ($1, $2, 'ACTIVE') RETURNING id",
    [role, institutionId],
  );
  await e2eSql(
    `INSERT INTO user_tokens (user_id, provider, subject, email, display_name, password_hash, must_change_password)
     VALUES ($1, 'PASSWORD', $2, $2, $3, $4, $5)`,
    [user.id, email, `Staff ${email.split("@")[0]}`, await hashPassword(STAFF_PASSWORD), mustChangePassword],
  );
  return { userId: user.id, email, password: STAFF_PASSWORD };
}

// Test setup only: the rows STILL Admin leaves behind once it has issued an institution and its
// account (SPEC §9.2, §10.5), so a test starts with someone who can sign in. Issuing accounts is
// tested through the admin UI. Pass `institutionCode` to join an institution a seed package created.
export async function seedInstitutionAccount(opts: { institutionCode?: string; mustChangePassword?: boolean } = {}): Promise<InstitutionAccount> {
  const id = tag();
  const code = opts.institutionCode ?? `STL-E2E-${id.toUpperCase()}`;
  const [institution] = await e2eSql<{ id: string; name: string }>(
    `INSERT INTO institutions (code, name) VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id, name`,
    [code, `E2E Museum ${id}`],
  );
  const account = await insertAccount("INSTITUTION", institution.id, `staff-${id}@museum.test`, opts.mustChangePassword ?? false);
  return { ...account, institutionId: institution.id, institutionCode: code, institutionName: institution.name };
}

// Test setup only: an ACTIVE operator, as `npm run admin:create` or STILL Admin would make one.
export async function seedOperator(opts: { mustChangePassword?: boolean } = {}): Promise<StaffAccount> {
  return insertAccount("ADMIN", null, `ops-${tag()}@still.test`, opts.mustChangePassword ?? false);
}

// A tRPC call as the console or STILL Admin app makes it: `x-client` picks that app's session (SPEC §11.1).
export const consoleCall = (page: Page, path: string, input: unknown = null) => trpcCall(page, path, input, { "x-client": "console" });
export const adminCall = (page: Page, path: string, input: unknown = null) => trpcCall(page, path, input, { "x-client": "admin" });

// Signs in through the API so a test can start on any console page. The sign-in form itself is
// covered by e2e/staff-sign-in.spec.ts.
export async function signInConsole(page: Page, account: InstitutionAccount, { remember = false } = {}) {
  await page.goto("/console/sign-in");
  const res = await consoleCall(page, "console.session.create", {
    institutionCode: account.institutionCode,
    email: account.email,
    password: account.password,
    remember,
  });
  if (res.status !== 200) throw new Error(`console sign-in failed: ${res.status} ${JSON.stringify(res.json)}`);
}

export async function signInAdmin(page: Page, account: StaffAccount) {
  await page.goto("/admin/sign-in");
  const res = await adminCall(page, "admin.session.create", { email: account.email, password: account.password });
  if (res.status !== 200) throw new Error(`admin sign-in failed: ${res.status} ${JSON.stringify(res.json)}`);
}
