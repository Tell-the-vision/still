import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { adminCall, consoleCall, e2eSql, seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// SPEC §9.2 발급, §9.5, §10.5: an operator adds an institution and issues its first account. There is
// no invite email; the temporary password is shown once.

test.use({ viewport: { width: 1440, height: 900 } });

// Short codes are letters only (2-6), so each test draws its own.
const letters = () => Array.from(randomUUID().replace(/[^a-f]/g, "").padEnd(6, "x").slice(0, 6)).join("").toUpperCase();

test("an operator adds an institution and its first account signs in with the temporary password", async ({ page }) => {
  await signInAdmin(page, await seedOperator());
  await page.goto("/admin/institutions");
  const short = letters();
  const name = `Dialog Museum ${randomUUID().slice(0, 8)}`;
  const email = `first-${randomUUID().slice(0, 8)}@museum.test`;

  await page.getByRole("button", { name: "Add institution" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Institution name").fill(name);
  await dialog.getByLabel("Short code (2–6 letters)").fill(short);
  await dialog.getByLabel("Workspace admin name").fill("Dana Curator");
  await dialog.getByLabel("Workspace admin email").fill(email);
  await dialog.getByRole("button", { name: "Create institution" }).click();

  const password = (await dialog.getByTestId("temporary-password").textContent())!.trim();
  expect(password.length).toBeGreaterThan(8);
  await expect(dialog.getByText("will not be shown again")).toBeVisible();

  const [row] = await e2eSql<{ code: string; status: string; mustChange: boolean; hash: string }>(
    `SELECT i.code, i.status, t.must_change_password AS "mustChange", t.password_hash AS hash
       FROM institutions i JOIN users u ON u.institution_id = i.id JOIN user_tokens t ON t.user_id = u.id
      WHERE i.name = $1`,
    [name],
  );
  expect(row.code).toMatch(new RegExp(`^STL-${short}-\\d{4,}$`));
  expect(row).toMatchObject({ status: "ACTIVE", mustChange: true });
  expect(row.hash).not.toContain(password);

  // The temporary password signs in at the console and must be changed.
  await page.context().clearCookies();
  await page.goto("/institutions/sign-in");
  await page.getByLabel("Institution ID").fill(row.code);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signedIn = page.waitForResponse(/console\.session\.create/);
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await signedIn).status()).toBe(200);
  expect((await consoleCall(page, "me.get")).json.result.data).toMatchObject({ email, mustChangePassword: true });
});

test("the server refuses a bad code, a taken code and a taken email, and only operators may call", async ({ page }) => {
  await signInAdmin(page, await seedOperator());
  const code = `STL-${letters()}-${Math.floor(Math.random() * 9000) + 1000}`;
  const create = (input: object) => adminCall(page, "admin.institution.create", { name: "API Museum", ...input });

  const bad = await create({ code: "not a code!" });
  expect(bad.status).toBe(400);
  expect(bad.json.error.data.appCode).toBe("CODE_INVALID");

  const made = await create({ code: code.toLowerCase() });
  expect(made.status).toBe(200);
  expect(made.json.result.data).toMatchObject({ code, name: "API Museum", displayStatus: "PENDING_SETUP", accountCount: 0 });
  const taken = await create({ code });
  expect(taken.status).toBe(409);
  expect(taken.json.error.data.appCode).toBe("CODE_TAKEN");

  const email = `api-${randomUUID().slice(0, 8)}@museum.test`;
  const account = { role: "INSTITUTION", institutionId: made.json.result.data.id, email, displayName: "API Admin" };
  const issued = await adminCall(page, "admin.account.create", account);
  expect(issued.status).toBe(200);
  expect(issued.json.result.data.account).toMatchObject({ role: "INSTITUTION", email, mustChangePassword: true, institution: { code } });
  expect(issued.json.result.data.temporaryPassword).toEqual(expect.any(String));
  expect(JSON.stringify(issued.json.result.data.account)).not.toContain("argon2");

  const dup = await adminCall(page, "admin.account.create", account);
  expect(dup.status).toBe(409);
  expect(dup.json.error.data.appCode).toBe("LOGIN_ID_TAKEN");
  const missing = await adminCall(page, "admin.account.create", { ...account, institutionId: randomUUID(), email: `x-${email}` });
  expect(missing.status).toBe(404);

  // A console session cannot call either procedure: not as itself (no STILL Admin session) and not
  // carried in the admin cookie (wrong role).
  const staff = await seedInstitutionAccount();
  await page.context().clearCookies();
  await signInConsole(page, staff);
  const calls = [["admin.institution.create", { code: "STL-NOPE-0001", name: "No" }], ["admin.account.create", account]] as const;
  for (const [path, input] of calls) expect((await consoleCall(page, path, input)).status).toBe(401);
  const token = (await page.context().cookies()).find((c) => c.name === "still_console_session")!.value;
  await page.context().addCookies([{ name: "still_admin_session", value: token, domain: new URL(page.url()).hostname, path: "/" }]);
  for (const [path, input] of calls) expect((await adminCall(page, path, input)).status).toBe(403);
});
