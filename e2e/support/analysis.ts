import { createHash, randomUUID } from "node:crypto";
import { expect, type Page } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./console";
import { consoleCall, seedInstitutionAccount, signInConsole } from "./staff";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: any }) => res.json.result.data;

// Leaves one EXTRACTED document (via the API and the dry-run R2 store) in a new exhibition. An array is one text per page.
export async function extractedExhibition(page: Page, text: string | string[], pageCount = Array.isArray(text) ? text.length : 1) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const documentId = await extractedDocument(page, account, exhibition, text, pageCount);
  return { exhibition, account, documentId };
}

// One more EXTRACTED document in an exhibition the page is signed in for. `pageCount` 0 is a scan with no
// text layer (no segments). An array is one text per page.
export async function extractedDocument(
  page: Page,
  account: { institutionId: string },
  exhibition: { id: string; code: string },
  text: string | string[],
  pageCount = Array.isArray(text) ? text.length : 1,
) {
  const put = async (url: string, body: Buffer) => expect((await page.request.put(url, { data: body })).status()).toBe(200);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = data(await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: `statement-${randomUUID().slice(0, 6)}.pdf`, mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  }));
  await put(created.upload.url, original);
  await consoleCall(page, "console.document.update", { id: created.document.id, uploaded: true });
  const manifest = Buffer.from(JSON.stringify({
    version: 1,
    document: { documentId: created.document.id, sha256: sha(original), mediaType: "application/pdf", pages: pageCount },
    extractor: { name: "test", version: "1" },
    pages: Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, size: [100, 100] })),
    segments: Array.from({ length: pageCount }, (_, i) => {
      const pageText = Array.isArray(text) ? text[i] : pageCount === 1 ? text : `${text} Page ${i + 1}.`;
      return { id: `s${String(i + 1).padStart(3, "0")}`, page: i + 1, bbox: null, text: pageText, sentences: [pageText] };
    }),
    assets: [], modelInputs: [], warnings: pageCount === 0 ? [{ code: "NO_TEXT_LAYER" }] : [],
  }));
  const upload = await consoleCall(page, "console.documentUpload.create", {
    documentId: created.document.id, files: [{ name: "manifest.v1.json", size: manifest.length, sha256: sha(manifest) }],
  });
  await put(data(upload).uploads[0].url, manifest);
  const key = `${account.institutionId}/${exhibition.id}/${created.document.id}/manifest.v1.json`;
  const done = await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: key });
  expect(data(done).status).toBe("EXTRACTED");
  return created.document.id as string;
}
