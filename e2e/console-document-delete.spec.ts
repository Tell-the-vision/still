import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import { seedExhibition, seedContent, type SeededExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.1-1 원본 불변, §9.4 업로드, §9.5 console.document.get / delete: an original can be downloaded, and
// removed only while nothing reviewed refers to it. R2_DRY_RUN=1 makes presigned URLs point at this app's /api/r2-dry-run.

test.use({ viewport: { width: 1440, height: 900 } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;

// Test setup only: a document row as the console leaves it after an upload.
async function seedDocument(account: InstitutionAccount, exhibition: SeededExhibition, name: string, status = "STORED") {
  const id = randomUUID();
  await e2eSql(
    `INSERT INTO documents (id, exhibition_id, object_key, original_name, media_type, byte_size, sha256, status)
     VALUES ($1, $2, $3, $4, 'application/pdf', 1024, $5, $6)`,
    [id, exhibition.id, `${account.institutionId}/${exhibition.id}/${id}/original.pdf`, name, randomUUID().replace(/-/g, "").padEnd(64, "0"), status],
  );
  return id;
}
async function seedImage(exhibition: SeededExhibition, documentId: string) {
  const id = randomUUID();
  await e2eSql(
    `INSERT INTO images (id, exhibition_id, object_key, width, height, document_id, manifest_asset_id, rights, verification)
     VALUES ($1, $2, $3, 10, 10, $4, $5, 'UNCONFIRMED', 'UNVERIFIED')`,
    [id, exhibition.id, `e2e/${id}.png`, documentId, `asset-${id}`],
  );
  return id;
}
const paragraph = (refs: string[]) => ({ type: "paragraph", id: "b1", text: "Text.", origin: "SOURCE", refs });

async function openMaterials(page: Page, account: InstitutionAccount, title: string) {
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).first().click();
  await page.getByRole("link", { name: "Exhibition materials" }).click();
  await expect(page.getByRole("heading", { name: "Exhibition materials" })).toBeVisible();
}

test("staff remove a stored file from the materials page; it is gone after reload", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedDocument(account, exhibition, "old-draft.pdf");
  await seedDocument(account, exhibition, "keep-me.pdf");
  await openMaterials(page, account, exhibition.title);

  await page.getByRole("button", { name: "Remove old-draft.pdf" }).click();
  await expect(page.getByRole("row", { name: /old-draft\.pdf/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row", { name: /keep-me\.pdf/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /old-draft\.pdf/ })).toHaveCount(0);
  expect(await e2eSql("SELECT 1 FROM documents WHERE exhibition_id = $1", [exhibition.id])).toHaveLength(1);
});

test("a file that reviewed content refers to cannot be removed", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const id = await seedDocument(account, exhibition, "statement.pdf");
  await seedContent(exhibition, { kind: "CURATOR_STATEMENT", status: "APPROVED", doc: [], blocks: [paragraph([`${id}:s1`])] });
  await openMaterials(page, account, exhibition.title);

  await page.getByRole("button", { name: "Remove statement.pdf" }).click();
  await expect(page.getByText("This file is used by reviewed content and cannot be removed.")).toBeVisible();
  await expect(page.getByRole("row", { name: /statement\.pdf/ })).toBeVisible();
  expect(await e2eSql("SELECT 1 FROM documents WHERE id = $1", [id])).toHaveLength(1);
});

test("a stuck uploading row disappears when cancelled", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const id = await seedDocument(account, exhibition, "stuck.pdf", "UPLOADING");
  await openMaterials(page, account, exhibition.title);

  await page.getByRole("row", { name: /stuck\.pdf/ }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("row", { name: /stuck\.pdf/ })).toHaveCount(0);
  expect(await e2eSql("SELECT 1 FROM documents WHERE id = $1", [id])).toHaveLength(0);
});

test("Download opens the presigned URL of the original", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const id = await seedDocument(account, exhibition, "press-kit.pdf");
  await openMaterials(page, account, exhibition.title);

  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Download press-kit.pdf" }).click();
  const url = new URL((await popup).url());
  expect(url.pathname).toMatch(/^\/api\/r2-dry-run\//);
  expect(url.pathname).toContain(`/${account.institutionId}/${exhibition.id}/${id}/original.pdf`);
});

test("console.document.get / delete: ownership, analysis lock, references, cascades", async ({ page, browser }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const id = await seedDocument(account, exhibition, "a.pdf");

  const got = data(await consoleCall(page, "console.document.get", { id }));
  expect(got).toMatchObject({ id, name: "a.pdf" });
  expect(got.download.url).toContain(`/${id}/original.pdf`);
  expect(new Date(got.download.expiresAt).getTime()).toBeGreaterThan(Date.now());

  const other = await seedInstitutionAccount();
  const context = await browser.newContext();
  const otherPage = await context.newPage();
  await signInConsole(otherPage, other);
  expect((await consoleCall(otherPage, "console.document.get", { id })).status).toBe(404);
  expect((await consoleCall(otherPage, "console.document.delete", { id })).status).toBe(404);
  await context.close();
  expect((await consoleCall(page, "console.document.delete", { id: randomUUID() })).status).toBe(404);

  await e2eSql(`UPDATE exhibitions SET analysis = '{"startedAt":"2026-01-01T00:00:00Z","result":null}'::jsonb WHERE id = $1`, [exhibition.id]);
  const busy = await consoleCall(page, "console.document.delete", { id });
  expect(busy.status).toBe(409);
  expect(busy.json.error.data.appCode).toBe("ANALYSIS_IN_PROGRESS");
  await e2eSql("UPDATE exhibitions SET analysis = NULL WHERE id = $1", [exhibition.id]);

  // An image block of the document's image keeps it, and so does the draft cover.
  const imageId = await seedImage(exhibition, id);
  const withImage = await seedContent(exhibition, {
    kind: "ARTWORK", status: "NEEDS_REVIEW",
    doc: [],
    blocks: [{ type: "image", id: "i1", imageId, display: "INLINE", captionRefs: [] }],
  });
  const inUse = await consoleCall(page, "console.document.delete", { id });
  expect(inUse.status).toBe(409);
  expect(inUse.json.error.data.appCode).toBe("DOCUMENT_IN_USE");
  await e2eSql("DELETE FROM contents WHERE id = $1", [withImage.id]);

  await e2eSql(`UPDATE exhibitions SET draft = jsonb_set(draft, '{coverImageId}', to_jsonb($2::text)) WHERE id = $1`, [exhibition.id, imageId]);
  expect((await consoleCall(page, "console.document.delete", { id })).json.error.data.appCode).toBe("DOCUMENT_IN_USE");
  await e2eSql(`UPDATE exhibitions SET draft = jsonb_set(draft, '{coverImageId}', 'null'::jsonb) WHERE id = $1`, [exhibition.id]);

  expect((await consoleCall(page, "console.document.delete", { id })).status).toBe(200);
  expect(await e2eSql("SELECT 1 FROM documents WHERE id = $1", [id])).toHaveLength(0);
  expect(await e2eSql("SELECT 1 FROM images WHERE id = $1", [imageId])).toHaveLength(0);
});
