import { expect, test } from "next/experimental/testmode/playwright";

test("home shows the wordmark and entry links, and QR Scan navigates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toBeVisible();
  await expect(page.getByText("STILL.", { exact: true })).toHaveCSS("font-size", "20px");
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(page.getByText("EXHIBITIONS")).toHaveCount(0);
  await page.getByRole("link", { name: "QR Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);
});

test("home uses the design kit: Montserrat wordmark, keyboard-reachable buttons, tab bar for guests", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toHaveCSS("font-family", /Montserrat/);
  await page.getByRole("link", { name: "Login" }).focus();
  await expect(page.getByRole("link", { name: "Login" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "QR Scan" })).toBeFocused();
});

test("the SPA fallback does not shadow the API", async ({ request }) => {
  const res = await request.get("/api/nope");
  expect(res.status()).toBe(404);
  expect(await res.text()).not.toContain('id="root"'); // not the SPA shell
  expect((await request.get("/api/trpc/nope")).status()).toBe(404);
});

test("guest Login sits in the header next to the scan icon", async ({ page }) => {
  await page.goto("/");
  const login = await page.getByRole("link", { name: "Login" }).boundingBox();
  const scan = await page.getByRole("link", { name: "QR Scan" }).boundingBox();
  expect(login!.x).toBeLessThan(scan!.x);
  expect(Math.abs(login!.y + login!.height / 2 - (scan!.y + scan!.height / 2))).toBeLessThanOrEqual(4);
});
