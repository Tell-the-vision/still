import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// SPEC §9.2 기관 목록 (A9), §9.5 admin.institution.list / get: an operator sees every institution
// with its ID, workspace admin and status, can search, and the API pages with a cursor.

test.use({ viewport: { width: 1440, height: 900 } });

type Item = { id: string; code: string; name: string; displayStatus: string };

// Three institutions sharing one unique word, created in a known order (oldest first): pending,
// active (its account has signed in) and suspended.
async function seedThree() {
  const word = `Zq${randomUUID().slice(0, 8)}`;
  const pending = await seedInstitutionAccount();
  const active = await seedInstitutionAccount();
  const suspended = await seedInstitutionAccount();
  const all = [pending, active, suspended];
  for (const [i, a] of all.entries()) {
    await e2eSql("UPDATE institutions SET name = $2, created_at = now() - interval '1 hour' + $3 * interval '1 second' WHERE id = $1", [
      a.institutionId, `${word} ${["Pending", "Active", "Suspended"][i]}`, i,
    ]);
  }
  await e2eSql("UPDATE user_tokens SET last_login_at = now() WHERE subject = $1", [active.email]);
  await e2eSql("UPDATE institutions SET status = 'SUSPENDED' WHERE id = $1", [suspended.institutionId]);
  return { word, pending, active, suspended };
}

test("an operator sees institutions in the table and searches them", async ({ page }) => {
  const { word, pending, active, suspended } = await seedThree();
  await signInAdmin(page, await seedOperator());
  await page.goto("/admin/institutions");
  await page.getByPlaceholder("Search institution name or ID").fill(word);
  const table = page.getByRole("table", { name: "Institutions" });
  await expect(table.getByRole("row")).toHaveCount(4); // header + three
  for (const [a, label] of [[pending, "Pending"], [active, "Active"], [suspended, "Suspended"]] as const) {
    const row = table.getByRole("row").filter({ hasText: a.institutionCode });
    await expect(row).toContainText(a.institutionCode);
    await expect(row).toContainText(a.email);
    await expect(row.locator(".pa-badge")).toHaveText(label);
  }
  await page.getByPlaceholder("Search institution name or ID").fill(suspended.institutionCode.toLowerCase());
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText(suspended.institutionName.replace(/E2E Museum \w+/, word));
});

test("admin.institution.list filters by status and q and walks pages with a cursor", async ({ page }) => {
  const { word, pending, active, suspended } = await seedThree();
  await signInAdmin(page, await seedOperator());
  const list = async (input: object) => {
    const res = await adminCall(page, "admin.institution.list", input);
    expect(res.status).toBe(200);
    return res.json.result.data as { items: Item[]; nextCursor: string | null; counts: Record<string, number> };
  };

  expect((await list({ q: word.toUpperCase() })).items.map((i) => i.id)).toEqual([suspended, active, pending].map((a) => a.institutionId));
  expect((await list({ q: pending.institutionCode.toLowerCase() })).items.map((i) => i.id)).toEqual([pending.institutionId]);
  for (const [status, who] of [["PENDING_SETUP", pending], ["ACTIVE", active], ["SUSPENDED", suspended]] as const) {
    const { items } = await list({ q: word, status });
    expect(items.map((i) => i.id)).toEqual([who.institutionId]);
    expect(items[0].displayStatus).toBe(status);
  }

  // Two pages of one, newest first, no repeats.
  const first = await list({ q: word, limit: 1 });
  expect(first.items.map((i) => i.id)).toEqual([suspended.institutionId]);
  expect(first.nextCursor).toEqual(expect.any(String));
  const second = await list({ q: word, limit: 1, cursor: first.nextCursor! });
  expect(second.items.map((i) => i.id)).toEqual([active.institutionId]);
  const third = await list({ q: word, limit: 1, cursor: second.nextCursor! });
  expect(third.items.map((i) => i.id)).toEqual([pending.institutionId]);
  expect(third.nextCursor).toBeNull();

  // Counts ignore q and status; the three display statuses add up to the total.
  const { counts } = await list({ q: word, status: "SUSPENDED" });
  expect(counts.pendingSetup).toBeGreaterThanOrEqual(1);
  expect(counts.active).toBeGreaterThanOrEqual(1);
  expect(counts.suspended).toBeGreaterThanOrEqual(1);
  expect(counts.active + counts.pendingSetup + counts.suspended).toBe(counts.total);
});

test("admin.institution.get returns one institution, NOT_FOUND for an unknown id", async ({ page }) => {
  const { active } = await seedThree();
  await signInAdmin(page, await seedOperator());
  const got = await adminCall(page, "admin.institution.get", { id: active.institutionId });
  expect(got.json.result.data).toMatchObject({
    id: active.institutionId,
    code: active.institutionCode,
    displayStatus: "ACTIVE",
    accountCount: 1,
    workspaceAdmin: { accountId: active.userId, email: active.email },
  });
  const missing = await adminCall(page, "admin.institution.get", { id: randomUUID() });
  expect(missing.status).toBe(404);
});

test("a console session cannot call admin.institution.list", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await signInConsole(page, account);
  expect((await consoleCall(page, "admin.institution.list", {})).status).toBeGreaterThanOrEqual(401);
  expect((await adminCall(page, "admin.institution.list", {})).status).toBe(401);
});
