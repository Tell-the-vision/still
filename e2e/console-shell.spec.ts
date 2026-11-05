import { expect, test } from "next/experimental/testmode/playwright";

// The museum staff app lives under /console as its own bundle. These tests prove it is
// reachable and stays separate from the visitor app. Without a console session the app
// asks me.get, gets UNAUTHORIZED and shows the sign-in screen, so that is what is asserted.

test.use({ viewport: { width: 1440, height: 900 } });

test("/console without a session opens the staff sign-in and is marked noindex", async ({ page }) => {
  const response = await page.goto("/console");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page).toHaveURL(/\/console\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("console deep links load the console app, not the visitor shell", async ({ page }) => {
  await page.goto("/console/exhibitions");
  await expect(page).toHaveURL(/\/console\/sign-in$/);
  await expect(page.getByText("Institution portal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "QR Scan" })).toHaveCount(0);
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
