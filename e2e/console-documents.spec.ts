import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 업로드, §10.6, §11.2: the browser PUTs the file straight to the private R2 bucket with a
// presigned URL; the server checks the declared type and size, never the bytes. R2_DRY_RUN=1 makes the
// presigned URL point at r2.dry-run.invalid, which these tests intercept.

test.use({ viewport: { width: 1440, height: 900 } });

const DRY_RUN_PUT = "https://r2.dry-run.invalid/**";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;
const pdfBytes = (tag: string) => Buffer.from(`%PDF-1.4\n% e2e ${tag}\n%%EOF\n`);

async function openMaterials(page: Page, account: InstitutionAccount, title: string) {
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).first().click();
  await page.getByRole("link", { name: "Exhibition materials" }).click();
  await expect(page.getByRole("heading", { name: "Exhibition materials" })).toBeVisible();
}

async function choose(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse files" }).click();
  await (await chooser).setFiles(file);
}

test("staff upload a PDF straight to R2; it stays uploaded after reload, and the same bytes under another name are flagged", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const puts: { url: string; method: string; body: Buffer | null }[] = [];
  await page.route(DRY_RUN_PUT, (route) => {
    const req = route.request();
    puts.push({ url: req.url(), method: req.method(), body: req.postDataBuffer() });
    return route.fulfill({ status: 200, body: "" });
  });
  await openMaterials(page, account, exhibition.title);

  const bytes = pdfBytes(randomUUID());
  await choose(page, { name: "wall-text.pdf", mimeType: "application/pdf", buffer: bytes });
  const row = page.getByRole("row", { name: /wall-text\.pdf/ });
  await expect(row.getByText("Uploaded", { exact: true })).toBeVisible();
  expect(puts).toHaveLength(1);
  expect(puts[0].method).toBe("PUT");
  expect(new URL(puts[0].url).pathname).toContain(`/${account.institutionId}/${exhibition.id}/`);
  expect(puts[0].body?.equals(bytes)).toBe(true);

  await page.reload();
  await expect(page.getByRole("row", { name: /wall-text\.pdf/ }).getByText("Uploaded", { exact: true })).toBeVisible();
  const [stored] = await e2eSql<{ status: string; original_name: string; object_key: string }>(
    "SELECT status, original_name, object_key FROM documents WHERE exhibition_id = $1", [exhibition.id]);
  expect(stored).toMatchObject({ status: "STORED", original_name: "wall-text.pdf" });
  expect(stored.object_key).toMatch(new RegExp(`^${account.institutionId}/${exhibition.id}/[0-9a-f-]{36}/original\\.pdf$`));

  await choose(page, { name: "wall-text-copy.pdf", mimeType: "application/pdf", buffer: bytes });
  await expect(page.getByRole("row", { name: /wall-text-copy\.pdf/ }).getByText("Same file as wall-text.pdf")).toBeVisible();
  const copy = await e2eSql<{ status: string; duplicate_of_id: string | null }>(
    "SELECT status, duplicate_of_id FROM documents WHERE original_name = 'wall-text-copy.pdf' AND exhibition_id = $1", [exhibition.id]);
  expect(copy[0].status).toBe("DUPLICATE");
  expect(copy[0].duplicate_of_id).not.toBeNull();
});

test("an unsupported file is refused before any upload and writes no row", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  let puts = 0;
  await page.route(DRY_RUN_PUT, (route) => { puts += 1; return route.fulfill({ status: 200, body: "" }); });
  await openMaterials(page, account, exhibition.title);

  await choose(page, { name: "notes.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") });
  await expect(page.getByRole("row", { name: /notes\.csv/ }).getByText(/not supported/)).toBeVisible();
  expect(puts).toBe(0);
  const rows = await e2eSql("SELECT 1 FROM documents WHERE exhibition_id = $1", [exhibition.id]);
  expect(rows).toHaveLength(0);
});

test("console.document.create refuses unsupported and oversized files; other institutions' documents are not found", async ({ page, browser }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const base = { code: exhibition.code, mediaType: "application/pdf", byteSize: 10, sha256: "a".repeat(64) };
  const tooBig = await consoleCall(page, "console.document.create", { ...base, name: "big.pdf", byteSize: 100 * 1024 * 1024 + 1 });
  expect(tooBig.status).toBe(400);
  expect(tooBig.json.error.data.appCode).toBe("SOURCE_TOO_LARGE");
  for (const [name, mediaType] of [["x.zip", "application/zip"], ["x.csv", "text/csv"], ["x.pdf", "text/html"]]) {
    const res = await consoleCall(page, "console.document.create", { ...base, name, mediaType });
    expect(res.status, name).toBe(400);
    expect(res.json.error.data.appCode, name).toBe("SOURCE_UNSUPPORTED");
  }
  expect(await e2eSql("SELECT 1 FROM documents WHERE exhibition_id = $1", [exhibition.id])).toHaveLength(0);

  const created = data(await consoleCall(page, "console.document.create", { ...base, name: "a.pdf" }));
  expect(created.upload).toMatchObject({ method: "PUT" });
  expect(created.document).toMatchObject({ status: "UPLOADING" });
  const manifest = await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: "x" });
  expect(manifest.status).toBe(400);

  const other = await seedInstitutionAccount();
  const context = await browser.newContext();
  const otherPage = await context.newPage();
  await signInConsole(otherPage, other);
  expect((await consoleCall(otherPage, "console.document.update", { id: created.document.id, uploaded: true })).status).toBe(404);
  expect((await consoleCall(otherPage, "console.document.list", { code: exhibition.code })).status).toBe(404);
  expect((await consoleCall(page, "console.document.update", { id: randomUUID(), uploaded: true })).status).toBe(404);
  await context.close();

  const failed = data(await consoleCall(page, "console.document.update", { id: created.document.id, failed: "ENCRYPTED" }));
  expect(failed).toMatchObject({ status: "FAILED", errorCode: "ENCRYPTED" });
});

test("pasted text is stored as one TXT original and is STORED at once", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const res = data(await consoleCall(page, "console.document.create", { code: exhibition.code, text: "Curator statement." }));
  expect(res.document).toMatchObject({ status: "STORED", mediaType: "text/plain" });
  expect(res.upload).toBeUndefined();
  const listed = (await consoleCall(page, "console.document.list", { code: exhibition.code })).json.result.data;
  expect(listed.map((d: { id: string }) => d.id)).toEqual([res.document.id]);
});
