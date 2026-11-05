import { expect, test } from "next/experimental/testmode/playwright";

// The museum staff app lives under /console as its own bundle. These tests prove it is
// reachable and stays separate from the visitor app. The console.* server procedures do
// not exist yet, so only the shell (header + sidebar) is asserted here.

test.use({ viewport: { width: 1440, height: 900 } });

test("/console opens the museum workspace shell and is marked noindex", async ({ page }) => {
  const response = await page.goto("/console");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page).toHaveURL(/\/console\/overview$/);
  await expect(page.getByText("Museum workspace", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Published exhibitions" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("console deep links load the console app, and the sidebar labels navigate", async ({ page }) => {
  await page.goto("/console/exhibitions");
  await expect(page.getByText("Museum workspace", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/workspace$/);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/account$/);
});

test("/console/sign-in shows the staff sign-in form", async ({ page }) => {
  await page.goto("/console/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await expect(page.getByLabel("Institution ID")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("visitor pages never load the console bundle", async ({ page }) => {
  const consoleRequests: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/console")) consoleRequests.push(r.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "QR Scan" })).toBeVisible();
  await expect(page.getByText("Museum workspace", { exact: true })).toHaveCount(0);
  expect(consoleRequests).toEqual([]);
});
