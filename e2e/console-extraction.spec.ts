import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "next/experimental/testmode/playwright";
import type { Page } from "@playwright/test";
import type { Manifest } from "../shared/src/manifest";
import { seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 추출, §10.6: after a file is stored the browser extracts it into a manifest, PUTs
// manifest.v1.json to the document's prefix and tells the server with console.document.update({ manifestKey }).
// The server half (console.documentUpload.create, manifestKey) is fulfilled here with page.route; R2_DRY_RUN=1
// makes presigned URLs point at r2.dry-run.invalid.

test.use({ viewport: { width: 1440, height: 900 } });

const DRY_RUN_PUT = "https://r2.dry-run.invalid/**";
const MANIFEST_URL = "https://r2.dry-run.invalid/manifest-stub/manifest.v1.json";
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const trpc = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { data } }) });

type Stub = { manifests: Manifest[]; creates: unknown[]; updates: unknown[]; originalPuts: number };

async function openMaterials(page: Page, account: InstitutionAccount, title: string) {
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).first().click();
  await page.getByRole("link", { name: "Exhibition materials" }).click();
  await expect(page.getByRole("heading", { name: "Exhibition materials" })).toBeVisible();
}

// Stubs the two procedures that do not exist on this base and records what the browser sends.
async function stubServer(page: Page): Promise<Stub> {
  const seen: Stub = { manifests: [], creates: [], updates: [], originalPuts: 0 };
  await page.route(DRY_RUN_PUT, (route) => {
    const req = route.request();
    if (req.url() === MANIFEST_URL) seen.manifests.push(JSON.parse(req.postData() ?? "null"));
    else seen.originalPuts += 1;
    return route.fulfill({ status: 200, body: "" });
  });
  // Originals go to the app's dry-run R2 store (src/server/media/r2-dry-run.ts): count them and let them through.
  await page.route("**/api/r2-dry-run/**", (route) => {
    if (route.request().method() === "PUT") seen.originalPuts += 1;
    return route.fallback();
  });
  await page.route("**/api/trpc/console.documentUpload.create", (route) => {
    const input = route.request().postDataJSON();
    seen.creates.push(input);
    return route.fulfill(trpc({ uploads: input.files.map((f: { name: string }) => ({ name: f.name, url: MANIFEST_URL, headers: {} })) }));
  });
  await page.route("**/api/trpc/console.document.update", async (route) => {
    const input = route.request().postDataJSON();
    if (!input.manifestKey) return route.continue();
    seen.updates.push(input);
    const [doc] = await e2eSql<{ id: string; original_name: string; media_type: string; byte_size: string; created_at: Date }>(
      "SELECT id, original_name, media_type, byte_size, created_at FROM documents WHERE id = $1", [input.id]);
    return route.fulfill(trpc({
      id: doc.id, name: doc.original_name, mediaType: doc.media_type, byteSize: Number(doc.byte_size),
      status: "EXTRACTED", errorCode: null, duplicateOfName: null, createdAt: doc.created_at,
    }));
  });
  return seen;
}

async function choose(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse files" }).click();
  await (await chooser).setFiles(file);
}

async function setUp(page: Page) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const seen = await stubServer(page);
  await openMaterials(page, account, exhibition.title);
  return seen;
}

test("a PDF is extracted in the browser into a manifest with line segments per page", async ({ page }) => {
  const seen = await setUp(page);
  const buffer = readFileSync("e2e/fixtures/two-pages.pdf");
  await choose(page, { name: "two-pages.pdf", mimeType: "application/pdf", buffer });

  const row = page.getByRole("row", { name: /two-pages\.pdf/ });
  await expect(row.getByText("Processed", { exact: true })).toBeVisible();
  expect(seen.originalPuts).toBe(1);
  expect(seen.manifests).toHaveLength(1);
  const manifest = seen.manifests[0];

  const [stored] = await e2eSql<{ id: string }>("SELECT id FROM documents WHERE original_name = 'two-pages.pdf'");
  expect(manifest.version).toBe(1);
  expect(manifest.document).toEqual({ documentId: stored.id, sha256: sha256(buffer), mediaType: "application/pdf", pages: 2 });
  expect(manifest.extractor).toEqual({ name: "console-extract", version: "1" });
  expect(manifest.pages).toEqual([{ page: 1, size: [612, 792] }, { page: 2, size: [612, 792] }]);
  expect(manifest.assets).toEqual([]);
  expect(manifest.modelInputs).toEqual([]);
  expect(manifest.warnings).toEqual([]);

  expect(manifest.segments.map((s) => [s.id, s.page, s.text])).toEqual([
    ["s001", 1, "Light and Water."],
    ["s002", 1, "A show about reflection. It opens in May!"],
    ["s003", 1, "Visit the east gallery."],
    ["s004", 2, "Second page begins here."],
    ["s005", 2, "Does it end? Yes."],
  ]);
  for (const s of manifest.segments) expect(s.sentences.join(" ")).toBe(s.text);
  expect(manifest.segments[1].sentences).toEqual(["A show about reflection.", "It opens in May!"]);
  expect(manifest.segments[0]).toMatchObject({ font: null, size: 14 }); // an unembedded standard font has no name for pdf.js;
  const [x0, top, x1, bottom] = manifest.segments[0].bbox!;
  expect(x0).toBeCloseTo(72, 0);
  expect(top).toBeLessThan(bottom);
  expect(x1).toBeGreaterThan(x0);

  expect(seen.creates).toEqual([{ documentId: stored.id, files: [{ name: "manifest.v1.json", size: expect.any(Number), sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }] }]);
  expect(seen.updates).toEqual([{ id: stored.id, manifestKey: "manifest.v1.json" }]);
});

test("a TXT file gives one segment per non-empty line, read as CP949 when it is not UTF-8", async ({ page }) => {
  const seen = await setUp(page);
  // "안녕하세요" and "빛과 물" in CP949 (euc-kr); invalid as UTF-8.
  const cp949 = Buffer.concat([Buffer.from("bec8b3e7c7cfbcbcbfe40d0a0a", "hex"), Buffer.from("bafbb0fa20b9b0", "hex")]);
  await choose(page, { name: "note.txt", mimeType: "text/plain", buffer: cp949 });
  await expect(page.getByRole("row", { name: /note\.txt/ }).getByText("Processed", { exact: true })).toBeVisible();
  expect(seen.manifests[0].segments.map((s) => [s.id, s.page, s.text])).toEqual([["s001", 1, "안녕하세요"], ["s002", 1, "빛과 물"]]);

  await choose(page, { name: "plain.txt", mimeType: "text/plain", buffer: Buffer.from("First line.  Two spaces.\n\n  Second line\r\nA L I G H T H O U S E\nThird") });
  await expect(page.getByRole("row", { name: /plain\.txt/ }).getByText("Processed", { exact: true })).toBeVisible();
  const [, utf8] = seen.manifests;
  expect(utf8.segments.map((s) => s.text)).toEqual(["First line. Two spaces.", "Second line", "A L I G H T H O U S E", "Third"]);
  expect(utf8.warnings).toEqual([{ code: "LETTER_SPACED", segment: "s003" }]); // reported, the text is not fixed
  expect(utf8.segments[0].sentences).toEqual(["First line.", "Two spaces."]);
  expect(utf8.document).toMatchObject({ mediaType: "text/plain", pages: 1 });
});

test("a DOCX stays uploaded with a note that extraction is not available yet, and sends no manifest", async ({ page }) => {
  const seen = await setUp(page);
  await choose(page, {
    name: "essay.docx", buffer: Buffer.from("PK-not-really-a-docx"),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const row = page.getByRole("row", { name: /essay\.docx/ });
  await expect(row.getByText("Uploaded", { exact: true })).toBeVisible();
  await expect(row.getByText("Text extraction for DOCX is not available yet.")).toBeVisible();
  expect(seen.manifests).toHaveLength(0);
  expect(seen.creates).toHaveLength(0);
  expect(seen.updates).toHaveLength(0);
});
