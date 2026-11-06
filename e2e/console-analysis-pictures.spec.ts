import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 구조화: Gemini gets a document's pictures as manifest asset ids, each where it sits among the lines it
// reads ("[image a01]"), and places them; the server maps the ids to the stored images. A marker the model copies
// as text (as the fake Worker does, answering with the page text) still becomes the picture.

test.use({ viewport: { width: 1440, height: 900 } });

const PICTURE = readFileSync("e2e/fixtures/cover.png"); // 4 x 3
const DISPLAY = readFileSync("e2e/fixtures/cover.webp");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: any }) => res.json.result.data;
type Block = { type: string; attrs: { imageId?: string }; content?: { text: string }[] };

test("a picture in an uploaded document is placed in the drafted page where it sits", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);

  // A one-page PDF as the browser extracts it: two lines with the picture between them.
  const put = async (url: string, body: Buffer) => expect((await page.request.put(url, { data: body })).status()).toBe(200);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = data(await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: "turner.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  }));
  await put(created.upload.url, original);
  await consoleCall(page, "console.document.update", { id: created.document.id, uploaded: true });
  const lines = ["Turner painted light all his life.", "Harbour at dusk, 1811."];
  const manifest = Buffer.from(JSON.stringify({
    version: 1,
    document: { documentId: created.document.id, sha256: sha(original), mediaType: "application/pdf", pages: 1 },
    extractor: { name: "test", version: "1" },
    pages: [{ page: 1, size: [100, 100] }],
    segments: [
      { id: "s001", page: 1, bbox: [10, 10, 90, 20], text: lines[0], sentences: [lines[0]] },
      { id: "s002", page: 1, bbox: [10, 70, 90, 80], text: lines[1], sentences: [lines[1]] },
    ],
    assets: [{ id: "a01", kind: "EMBEDDED", object: "assets/a01.png", display: "assets/a01.display.webp", format: "image/png", pixels: [4, 3], sha256: sha(PICTURE), placements: [{ page: 1, bbox: [10, 30, 90, 60] }] }],
    modelInputs: [],
    warnings: [],
  }));
  const files = [
    { name: "assets/a01.png", bytes: PICTURE },
    { name: "assets/a01.display.webp", bytes: DISPLAY },
    { name: "manifest.v1.json", bytes: manifest },
  ];
  const { uploads } = data(await consoleCall(page, "console.documentUpload.create", { documentId: created.document.id, files: files.map((f) => ({ name: f.name, size: f.bytes.length, sha256: sha(f.bytes) })) }));
  for (const f of files) await put(uploads.find((u: { name: string }) => u.name === f.name).url, f.bytes);
  expect(data(await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: "manifest.v1.json" })).status).toBe("EXTRACTED");
  const [image] = await e2eSql<{ id: string }>("SELECT id FROM images WHERE document_id = $1 AND manifest_asset_id = 'a01'", [created.document.id]);

  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await e2eSql<{ result: string | null }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]))[0].result, { timeout: 30_000 }).toBe("SUCCEEDED");

  // The picture follows the text above it, as the stored image, and no marker is left in the text.
  const [content] = await e2eSql<{ doc: { content: Block[] } }>("SELECT doc FROM contents WHERE exhibition_id = $1", [exhibition.id]);
  expect(content.doc.content.map((b) => b.type)).toEqual(["paragraph", "stillImage"]);
  expect(content.doc.content[1].attrs.imageId).toBe(image.id);
  expect(JSON.stringify(content.doc)).not.toContain("[image");

  // The curator sees it in the drafted page.
  await page.goto("/console/");
  await expect(page.locator(".ProseMirror figure[data-still-image] img")).toBeVisible();
});
