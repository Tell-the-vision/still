import { expect, test } from "next/experimental/testmode/playwright";
import { loggable } from "../src/server/log-safe";
import { clientIp, ipAllowed } from "../src/server/rate-limit";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, STAFF_PASSWORD } from "./support/staff";

test("a blank rate-limit setting uses the default instead of refusing every call", () => {
  const saved = process.env.RATE_LIMIT_IP_PER_MIN;
  process.env.RATE_LIMIT_IP_PER_MIN = "";
  try {
    expect(ipAllowed(new Request("https://still.test/", { headers: { "x-forwarded-for": "198.51.100.7" } }))).toBe(true);
  } finally {
    process.env.RATE_LIMIT_IP_PER_MIN = saved;
  }
});

test("behind the proxy the client address is the hop the proxy appended, not the client's first entry", () => {
  const saved = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  try {
    expect(clientIp(new Request("https://still.test/", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" } }))).toBe("203.0.113.9");
  } finally {
    process.env.TRUST_PROXY = saved;
  }
});

test("a failed query is logged without its SQL values or the Postgres detail", () => {
  const failed = { query: "insert into users values ($1)", params: ["secret@museum.test"], cause: { name: "error", code: "23505", severity: "ERROR", message: "duplicate key value violates unique constraint", constraint: "users_email_key", table: "users", detail: "Key (email)=(secret@museum.test) already exists." } };
  const logged = JSON.stringify(loggable(failed));
  expect(logged).toContain("23505");
  expect(logged).not.toContain("secret@museum.test");
});

const signIn = (page: import("@playwright/test").Page, account: { institutionCode: string; email: string }, password = STAFF_PASSWORD) =>
  page.goto("/console/sign-in").then(() => consoleCall(page, "console.session.create", { institutionCode: account.institutionCode, email: account.email, password, remember: false }));

// SPEC §10.5: a session on its temporary password may only change it, see itself or sign out.
test("the QR route refuses a session that must still change its temporary password", async ({ page }) => {
  const account = await seedInstitutionAccount({ mustChangePassword: true });
  const exhibition = await seedExhibition(account);
  expect((await signIn(page, account)).status).toBe(200);
  const res = await page.request.get(`/api/console/qr?code=${exhibition.code}&format=svg`);
  expect(res.status()).toBe(401);
});

test("the new password must differ, and guessing the current one locks like sign-in", async ({ page }) => {
  const account = await seedInstitutionAccount();
  expect((await signIn(page, account)).status).toBe(200);
  const same = await consoleCall(page, "password.update", { currentPassword: STAFF_PASSWORD, newPassword: STAFF_PASSWORD });
  expect(same.status).toBe(400);
  for (let i = 0; i < 10; i++) {
    expect((await consoleCall(page, "password.update", { currentPassword: `wrong-guess-${i}-xxxx`, newPassword: "a-brand-new-password-1" })).status).toBe(400);
  }
  const [row] = await e2eSql<{ locked_until: Date | null }>("SELECT locked_until FROM user_tokens WHERE subject = $1", [account.email]);
  expect(row.locked_until).not.toBeNull();
  // Even the right password is refused while locked.
  expect((await consoleCall(page, "password.update", { currentPassword: STAFF_PASSWORD, newPassword: "a-brand-new-password-1" })).status).toBe(400);
});
