import { expect, test } from "next/experimental/testmode/playwright";
import { seedInstitutionAccount, seedOperator, signInAdmin } from "./support/staff";

// SPEC §9.2, §9.5: an operator issues operators and suspends, reactivates, resets and deletes accounts from Users & access.

test.use({ viewport: { width: 1440, height: 900 } });

test("the operator manages accounts from Users & access", async ({ page }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());
  await page.goto("/admin/institutions");
  await page.getByRole("link", { name: "Users & access" }).click();
  await expect(page.getByRole("heading", { name: "Users & access" })).toBeVisible();

  // Add an operator: the temporary password appears once.
  const spare = `spare-${Date.now()}@still.test`;
  await page.getByRole("button", { name: "Add operator" }).click();
  await page.getByLabel("Name").fill("Spare Operator");
  await page.getByLabel("Email").fill(spare);
  await page.getByRole("button", { name: "Issue account" }).click();
  const notice = page.getByRole("status").filter({ hasText: "Temporary password" });
  await expect(notice).toContainText(spare);
  await expect(notice).toContainText("shown only once");
  await expect(notice.locator("code")).toHaveText(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/i);
  await expect(notice.getByRole("button", { name: "Copy" })).toBeVisible();
  await page.screenshot({ path: "/Users/phihu/Desktop/still-wt/shots/users/users.png" });

  // Suspend and reactivate an institution account.
  const row = page.getByRole("row").filter({ hasText: staff.email });
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: `Suspend ${staff.email}` }).click();
  await expect(row).toContainText("Suspended");
  await row.getByRole("button", { name: `Reactivate ${staff.email}` }).click();
  await expect(row).toContainText("Active");

  // Reset its password: a new one is shown once.
  await row.getByRole("button", { name: `Reset password for ${staff.email}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Temporary password" })).toContainText(staff.email);
  await expect(page.getByRole("status").filter({ hasText: "Temporary password" }).locator("code")).toBeVisible();

  // Delete the spare operator after confirming on the page.
  const spareRow = page.getByRole("row").filter({ hasText: spare });
  await spareRow.getByRole("button", { name: `Delete ${spare}` }).click();
  await spareRow.getByRole("button", { name: "Confirm delete" }).click();
  await expect(spareRow).toHaveCount(0);
});

// Users & access must fit narrower windows like the other admin tables (1280px and 900px breakpoints).
test("Users & access fits a 1024px window and stacks its rows below 900px", async ({ page }) => {
  const staff = await seedInstitutionAccount();
  await signInAdmin(page, await seedOperator());
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/admin/users");
  const row = page.getByRole("row").filter({ hasText: staff.email });
  await expect(row).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 800, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Stacked rows label the sign-in date, not "Created", which belongs to the institutions table.
  await expect(row).not.toContainText("Created");
});
