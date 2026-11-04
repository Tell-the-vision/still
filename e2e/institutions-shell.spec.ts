import { expect, test } from "next/experimental/testmode/playwright";

// The museum staff app lives under /institutions as its own bundle. These tests prove it is
// reachable and stays separate from the visitor app. The institutions.* server procedures do
// not exist yet, so only the shell (header + sidebar) is asserted here.

test.use({ viewport: { width: 1440, height: 900 } });

test("/institutions opens the museum workspace shell and is marked noindex", async ({ page }) => {
  const response = await page.goto("/institutions");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page).toHaveURL(/\/institutions\/overview$/);
  await expect(page.getByText("Museum workspace", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Published exhibitions" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("institutions deep links load the institutions app, and the sidebar labels navigate", async ({ page }) => {
  await page.goto("/institutions/exhibitions");
  await expect(page.getByText("Museum workspace", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/workspace$/);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/account$/);
});

test("visitor pages never load the institutions bundle", async ({ page }) => {
  const institutionsRequests: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/institutions")) institutionsRequests.push(r.url()); });
  await page.goto("/");
  await expect(page.getByText("Art stays with you.")).toBeVisible();
  await expect(page.getByText("Museum workspace", { exact: true })).toHaveCount(0);
  expect(institutionsRequests).toEqual([]);
});
