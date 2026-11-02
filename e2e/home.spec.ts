import { expect, test } from "next/experimental/testmode/playwright";

test("home shows the wordmark and entry links, and QR Scan navigates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);
});

test("the SPA fallback does not shadow the API", async ({ request }) => {
  const res = await request.get("/api/nope");
  expect(res.status()).toBe(404);
  expect(await res.text()).not.toContain('id="root"'); // not the SPA shell
  expect((await request.get("/api/trpc/nope")).status()).toBe(404);
});
