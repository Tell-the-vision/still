import sharp from "sharp";
import { readBarcodes } from "zxing-wasm/reader";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.5 GET /api/console/qr: the QR of {STILL_ORIGIN}/e/{code} (SPEC §1.2) for one of the
// console session's own exhibitions, and SPEC §9.4 the publication-complete page that downloads it.

test.use({ viewport: { width: 1440, height: 900 } });

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function decodePng(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [result] = await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" } as ImageData);
  return result?.text;
}

test("staff download the QR of a published exhibition from the publication-complete page", async ({ page, baseURL }) => {
  const account = await seedInstitutionAccount();
  const live = await seedExhibition(account, { title: "Tidal", state: "PUBLISHED" });
  await signInConsole(page, account);

  await page.goto("/institutions/exhibitions");
  await page.getByText(live.title, { exact: true }).click();
  await page.goto("/institutions/materials/published");
  await expect(page.getByRole("heading", { name: "Your guide is live." })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download QR (PNG)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${live.code}-qr.png`);
  const png = Buffer.from(await (await import("node:fs/promises")).readFile((await file.path())!));
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  const { width, height } = await sharp(png).metadata();
  expect(width).toBeGreaterThanOrEqual(512);
  expect(height).toBe(width);
  expect(await decodePng(png)).toBe(`${baseURL}/e/${live.code}`);
});

test("the QR route serves png and svg for the session's own exhibition", async ({ page, baseURL }) => {
  const account = await seedInstitutionAccount();
  const draft = await seedExhibition(account); // the URL is fixed at creation, so any state works
  await signInConsole(page, account);

  const png = await page.request.get(`/api/console/qr?code=${draft.code}&format=png`);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  expect(png.headers()["cache-control"]).toBe("private, no-store");
  expect(png.headers()["content-disposition"]).toBe(`inline; filename="${draft.code}-qr.png"`);
  expect(await decodePng(await png.body())).toBe(`${baseURL}/e/${draft.code}`);

  const svg = await page.request.get(`/api/console/qr?code=${draft.code}&format=svg`);
  expect(svg.status()).toBe(200);
  expect(svg.headers()["content-type"]).toBe("image/svg+xml");
  expect(svg.headers()["content-disposition"]).toBe(`inline; filename="${draft.code}-qr.svg"`);
  const text = await svg.text();
  expect(text).toMatch(/^<svg[\s\S]*<path[^>]* d="M/);
  const raster = await sharp(Buffer.from(text), { density: 300 }).png().toBuffer();
  expect(await decodePng(raster)).toBe(`${baseURL}/e/${draft.code}`);
});

test("the QR route refuses no session, other institutions' codes and bad formats", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const mine = await seedExhibition(account);
  const other = await seedExhibition(await seedInstitutionAccount(), { state: "PUBLISHED" });

  expect((await page.request.get(`/api/console/qr?code=${mine.code}&format=png`)).status()).toBe(401);

  await signInConsole(page, account);
  expect((await page.request.get(`/api/console/qr?code=${mine.code}&format=gif`)).status()).toBe(400);
  expect((await page.request.get(`/api/console/qr?code=${mine.code}`)).status()).toBe(400);
  const foreign = await page.request.get(`/api/console/qr?code=${other.code}&format=png`);
  const unknown = await page.request.get(`/api/console/qr?code=e2e-nothing&format=png`);
  expect(foreign.status()).toBe(404);
  expect(unknown.status()).toBe(404);
  expect(await foreign.text()).toBe(await unknown.text());
});
