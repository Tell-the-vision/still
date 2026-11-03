import { expect, test } from "next/experimental/testmode/playwright";

test("AASA and assetlinks are served as JSON", async ({ request }) => {
  const aasa = await request.get("/.well-known/apple-app-site-association");
  expect(aasa.status()).toBe(200);
  expect(aasa.headers()["content-type"]).toContain("application/json");
  expect(await aasa.text()).toContain('"/e/*"');
  const links = await request.get("/.well-known/assetlinks.json");
  expect(links.status()).toBe(200);
  expect(links.headers()["content-type"]).toContain("application/json");
  const [entry] = await links.json();
  expect(entry.target.sha256_cert_fingerprints).toEqual(["AA:11", "BB:22"]);
});

test("a pasted full guide URL opens the guide", async ({ page, baseURL }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await page.getByLabel("Exhibition URL or code").fill(`${baseURL}/e/forms-of-stillness`);
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
});
