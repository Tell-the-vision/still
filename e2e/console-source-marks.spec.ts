import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// (helpers from console-manifest.spec.ts)
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


const text = (value: string) => ({ type: "text", text: value });
const paragraph = (id: string, value: string) => ({ type: "paragraph", attrs: { id }, content: [text(value)] });

// SPEC §9.4 원문 대조 표시, §10.8 sources: the label is computed against the manifest text, and
// "Revert to source" writes the source text back.
test("blocks are labelled Source / Edited / No source and an edited one reverts to its source", async ({ page }) => {
  const s = await storedDocument(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(data(await extract(page, s, validManifest(s))).status).toBe("EXTRACTED");
  const ref = `${s.documentId}:s001`;
  const content = await seedContent(s.exhibition, {
    kind: "ARTWORK", status: "READY",
    doc: [paragraph("b1", "One   two."), paragraph("b2", "One 2 changed."), paragraph("b3", "Written by hand.")],
    sources: { b1: { refs: [ref], start: 0, end: 8 }, b2: { refs: [ref], start: 0, end: 8 } },
  });
  const got = await consoleCall(page, "console.content.get", { id: content.id });
  expect(data(got).sources.b1.text).toBe("One two.");

  await page.goto("/console/exhibitions");
  await page.getByText(s.exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  const labels = page.locator(".source-gutter__label");
  await expect(labels.nth(0)).toHaveText("Source");
  await expect(labels.nth(1)).toHaveText("Edited");
  await expect(labels.nth(2)).toHaveText("No source");
  await labels.nth(1).click();
  const panel = page.locator(".source-panel");
  await expect(panel.locator("del, ins").first()).toBeVisible();
  await expect(panel.locator("del")).toContainText("two.");
  await labels.nth(0).click();
  await expect(page.locator(".source-panel").getByRole("button", { name: "Revert to source" })).toHaveCount(0);
  await labels.nth(1).click();

  await page.locator(".source-panel").getByRole("button", { name: "Revert to source" }).click();
  await expect(labels.nth(1)).toHaveText("Source");
  // The editor shows the reverted text, not the text it was opened with.
  await expect(page.locator(".ProseMirror")).not.toContainText("One 2 changed.");
  const [row] = await e2eSql<{ doc: { content: { attrs: { id: string }; content: { text: string }[] }[] } }>("SELECT doc FROM contents WHERE id = $1", [content.id]);
  expect(row.doc.content.find((b) => b.attrs.id === "b2")?.content).toEqual([{ type: "text", text: "One two." }]);
});

// A source whose document has no manifest yet cannot be read: the block is "No source", never "Edited",
// so "Revert to source" cannot blank it.
test("a block traced to a document without a manifest reads No source and cannot be reverted", async ({ page }) => {
  const s = await storedDocument(page);
  const content = await seedContent(s.exhibition, {
    kind: "ARTWORK", status: "READY",
    doc: [paragraph("b1", "Kept as written.")],
    sources: { b1: { refs: [`${s.documentId}:s001`], start: 0, end: 8 } },
  });
  expect(data(await consoleCall(page, "console.content.get", { id: content.id })).sources.b1.text).toBeNull();

  await page.goto("/console/exhibitions");
  await page.getByText(s.exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await expect(page.locator(".source-gutter__label").first()).toHaveText("No source");
  await page.locator(".source-gutter__label").first().click();
  await expect(page.getByRole("button", { name: "Revert to source" })).toHaveCount(0);
});
