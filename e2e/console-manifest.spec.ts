import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 처리 구조, §9.5 console.documentUpload.create / console.document.update({manifestKey}), §10.6 매니페스트:
// the browser puts extraction outputs into the private bucket, then names the manifest; the server validates it.
// R2_DRY_RUN=1 keeps the objects on local disk behind /api/r2-dry-run, so the bytes really travel.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

type Setup = { account: InstitutionAccount; exhibition: Awaited<ReturnType<typeof seedExhibition>>; documentId: string; sha256: string };

async function put(page: Page, url: string, body: Buffer | string) {
  const res = await page.request.put(url, { data: body });
  expect(res.status()).toBe(200);
}
async function upload(page: Page, documentId: string, name: string, body: Buffer | string) {
  const bytes = Buffer.from(body);
  const res = await consoleCall(page, "console.documentUpload.create", { documentId, files: [{ name, size: bytes.length, sha256: sha(bytes) }] });
  expect(res.status).toBe(200);
  await put(page, data(res).uploads[0].url, bytes);
}

// A document the way the console leaves it once the original has been uploaded and reported (STORED).
async function storedDocument(page: Page): Promise<Setup> {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: "statement.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  });
  const document = data(created).document;
  await put(page, data(created).upload.url, original);
  const marked = await consoleCall(page, "console.document.update", { id: document.id, uploaded: true });
  expect(data(marked).status).toBe("STORED");
  return { account, exhibition, documentId: document.id, sha256: sha(original) };
}

const validManifest = (s: Setup, over: Record<string, unknown> = {}) => ({
  version: 1,
  document: { documentId: s.documentId, sha256: s.sha256, mediaType: "application/pdf", pages: 1 },
  extractor: { name: "test", version: "1" },
  pages: [{ page: 1, size: [100, 100] }],
  segments: [{ id: "s001", page: 1, bbox: null, text: "One two. Three.", sentences: ["One two.", "Three."] }],
  assets: [{
    id: "a01", kind: "EMBEDDED", object: "assets/a01.jpg", display: "assets/a01.display.webp", format: "jpeg", pixels: [320, 180],
    sourceRange: { offset: 10, length: 20 }, sha256: "a".repeat(64), placements: [],
  }],
  modelInputs: [],
  warnings: [],
  ...over,
});

// Uploads the asset files and the manifest under `manifest.v1.json`, then reports it.
async function extract(page: Page, s: Setup, manifest: unknown, version = 1) {
  await upload(page, s.documentId, "assets/a01.jpg", "jpeg-bytes");
  await upload(page, s.documentId, "assets/a01.display.webp", "webp-bytes");
  const name = `manifest.v${version}.json`;
  await upload(page, s.documentId, name, JSON.stringify(manifest));
  const key = `${s.account.institutionId}/${s.exhibition.id}/${s.documentId}/${name}`;
  return consoleCall(page, "console.document.update", { id: s.documentId, manifestKey: key });
}

test("a valid manifest marks the document EXTRACTED and makes an image row per asset", async ({ page }) => {
  const s = await storedDocument(page);
  const res = await extract(page, s, validManifest(s));
  expect(res.status).toBe(200);
  expect(data(res).status).toBe("EXTRACTED");
  const [doc] = await e2eSql<{ manifest_object_key: string; analyzed_at: string | null }>("SELECT manifest_object_key, analyzed_at FROM documents WHERE id = $1", [s.documentId]);
  expect(doc.manifest_object_key).toMatch(/\/manifest\.v1\.json$/);
  expect(doc.analyzed_at).toBeNull();
  const rows = await e2eSql("SELECT manifest_asset_id, object_key, rights, verification, width, height FROM images WHERE document_id = $1", [s.documentId]);
  expect(rows).toEqual([{ manifest_asset_id: "a01", object_key: null, rights: "UNCONFIRMED", verification: "UNVERIFIED", width: 320, height: 180 }]);
});

test("a manifest whose sentences do not rejoin to the text fails the document as MANIFEST_INVALID", async ({ page }) => {
  const s = await storedDocument(page);
  const bad = validManifest(s, { segments: [{ id: "s001", page: 1, bbox: null, text: "One two. Three.", sentences: ["One two.", "Four."] }] });
  const res = await extract(page, s, bad);
  expect(res.status).toBe(200);
  expect(data(res).status).toBe("FAILED");
  expect(data(res).errorCode).toBe("MANIFEST_INVALID");
  expect(await e2eSql("SELECT 1 FROM images WHERE document_id = $1", [s.documentId])).toHaveLength(0);
});

test("a manifest for another document, or naming a missing object, fails as MANIFEST_INVALID", async ({ page }) => {
  const s = await storedDocument(page);
  const wrongId = await extract(page, s, validManifest(s, { document: { documentId: randomUUID(), sha256: s.sha256, mediaType: "application/pdf", pages: 1 } }));
  expect(data(wrongId).errorCode).toBe("MANIFEST_INVALID");

  const t = await storedDocument(page);
  const missing = validManifest(t, { pages: [{ page: 1, size: [100, 100], render: "pages/p001.png" }] }); // never uploaded
  expect(data(await extract(page, t, missing)).errorCode).toBe("MANIFEST_INVALID");

  const u = await storedDocument(page);
  const escaping = validManifest(u, { pages: [{ page: 1, size: [100, 100], render: "../other/pages/p001.png" }] });
  expect(data(await extract(page, u, escaping)).errorCode).toBe("MANIFEST_INVALID");
});

test("documentUpload.create refuses keys outside the document prefix and names it does not allow", async ({ page }) => {
  const s = await storedDocument(page);
  for (const name of ["../x.json", "assets/../../x.png", "/manifest.v1.json", "original.pdf", "manifest.v1.json/../../y", "other/p001.png", `${randomUUID()}/v1/page-001.webp`]) {
    const res = await consoleCall(page, "console.documentUpload.create", { documentId: s.documentId, files: [{ name, size: 1, sha256: "0".repeat(64) }] });
    expect(res.status, name).toBe(400);
  }
  const ok = await consoleCall(page, "console.documentUpload.create", {
    documentId: s.documentId,
    files: [{ name: "manifest.v1.json", size: 1, sha256: "0".repeat(64) }, { name: "pages/p001.png", size: 1, sha256: "0".repeat(64) }, { name: `${s.documentId}/v1/page-001.webp`, size: 1, sha256: "0".repeat(64) }],
  });
  expect(data(ok).uploads).toHaveLength(3);
  expect(data(ok).uploads[0].url).toContain(`/${s.account.institutionId}/${s.exhibition.id}/${s.documentId}/manifest.v1.json`);
});

test("re-extracting a document that content refers to is refused; an unused one gets a new manifest", async ({ page }) => {
  const s = await storedDocument(page);
  expect(data(await extract(page, s, validManifest(s))).status).toBe("EXTRACTED");
  const again = await extract(page, s, validManifest(s), 2);
  expect(data(again).status).toBe("EXTRACTED");
  expect(await e2eSql("SELECT 1 FROM images WHERE document_id = $1", [s.documentId])).toHaveLength(1);

  await seedContent(s.exhibition, {
    kind: "CURATOR_STATEMENT", status: "APPROVED",
    blocks: [{ type: "paragraph", id: "b1", text: "One two.", origin: "SOURCE", refs: [`${s.documentId}:s001`] }],
  });
  const refused = await extract(page, s, validManifest(s), 3);
  expect(refused.json.error.data.appCode).toBe("DOCUMENT_IN_USE");
  const [doc] = await e2eSql<{ manifest_object_key: string }>("SELECT manifest_object_key FROM documents WHERE id = $1", [s.documentId]);
  expect(doc.manifest_object_key).toMatch(/manifest\.v2\.json$/);
});

test("another institution's document is NOT_FOUND", async ({ page }) => {
  const s = await storedDocument(page);
  await signInConsole(page, await seedInstitutionAccount());
  const key = `${s.account.institutionId}/${s.exhibition.id}/${s.documentId}/manifest.v1.json`;
  expect((await consoleCall(page, "console.document.update", { id: s.documentId, manifestKey: key })).json.error.data.code).toBe("NOT_FOUND");
  const up = await consoleCall(page, "console.documentUpload.create", { documentId: s.documentId, files: [{ name: "manifest.v1.json", size: 1, sha256: "0".repeat(64) }] });
  expect(up.json.error.data.code).toBe("NOT_FOUND");
});

test("the dry-run store refuses path traversal", async ({ page }) => {
  const res = await page.request.put("/api/r2-dry-run/private-dry-run/%2e%2e/%2e%2e/escaped.txt", { data: "x" });
  expect(res.status()).toBe(404);
  expect((await page.request.get("/api/r2-dry-run/private-dry-run/..%2f..%2fetc/passwd")).status()).toBe(404);
  expect((await page.request.get("/api/r2-dry-run/private-dry-run/never/stored.txt")).status()).toBe(404);
});
