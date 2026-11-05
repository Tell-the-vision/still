import { expect, test } from "next/experimental/testmode/playwright";
import { seedInstitutionAccount, signInConsole } from "./support/staff";

// The museum staff app lives under /institutions as its own bundle. These tests prove it is
// reachable and stays separate from the visitor app. Most console.* procedures do not exist
// yet, so only the shell (header + sidebar) is asserted here.

test.use({ viewport: { width: 1440, height: 900 } });

test("/institutions opens the museum workspace shell for signed-in staff and is marked noindex", async ({ page }) => {
  const response = await page.goto("/institutions");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  // No console session: the sign-in screen (SPEC §10.5).
  await expect(page).toHaveURL(/\/institutions\/sign-in$/);

  await signInConsole(page, await seedInstitutionAccount());
  await page.goto("/institutions");
  await expect(page).toHaveURL(/\/institutions\/overview$/);
  await expect(page.getByRole("banner").getByText("Museum workspace", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Published exhibitions" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("institutions deep links load the institutions app, and the sidebar labels navigate", async ({ page }) => {
  await signInConsole(page, await seedInstitutionAccount());
  await page.goto("/institutions/exhibitions");
  await expect(page.getByRole("banner").getByText("Museum workspace", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/workspace$/);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/account$/);
});

test("/institutions/sign-in shows the staff sign-in form", async ({ page }) => {
  await page.goto("/institutions/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await expect(page.getByLabel("Institution ID")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("visitor pages never load the institutions bundle", async ({ page }) => {
  const institutionsRequests: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/institutions")) institutionsRequests.push(r.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "QR Scan" })).toBeVisible();
  await expect(page.getByText("Museum workspace", { exact: true })).toHaveCount(0);
  expect(institutionsRequests).toEqual([]);
});
