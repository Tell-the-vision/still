import { expect, test } from "next/experimental/testmode/playwright";
import { seedOperator, signInAdmin } from "./support/staff";

// The STILL platform admin app lives under /admin as its own bundle. These tests prove it is
// reachable, marked noindex and stays separate from the visitor and museum staff apps. The
// admin.institution.* procedures do not exist yet, so only the shell is asserted here.

test.use({ viewport: { width: 1440, height: 900 } });

test("/admin opens the platform admin shell for a signed-in operator and is marked noindex", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  // No STILL Admin session: the sign-in screen (SPEC §10.5).
  await expect(page).toHaveURL(/\/admin\/sign-in$/);

  await signInAdmin(page, await seedOperator());
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/institutions$/);
  await expect(page.getByRole("heading", { name: "Institutions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("visitor and museum staff pages never load the admin bundle", async ({ page }) => {
  const adminRequests: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/admin")) adminRequests.push(r.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "QR Scan" })).toBeVisible();
  await page.goto("/console/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  expect(adminRequests).toEqual([]);
});
