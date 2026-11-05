import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";
import { seedExhibition } from "./support/console";

// SPEC §10.7 검증, §10.10 document.verify, §9.7: a manifest asset whose source range hashes to its sha256 is
// VERIFIED, any other is MISMATCH, and a MISMATCH fails the preview's "Image verification" check.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

test("document.verify marks matching ranges VERIFIED and others MISMATCH", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const embedded = Buffer.from("embedded-image-bytes");
  const original = Buffer.concat([Buffer.from(`%PDF-1.4 ${randomUUID()} `), embedded, Buffer.from(" trailer")]);
  const offset = original.indexOf(embedded);
  const created = await consoleCall(page, "console.document.create", { code: exhibition.code, name: "s.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original) });
  const documentId = data(created).document.id as string;
  expect((await page.request.put(data(created).upload.url, { data: original })).status()).toBe(200);
  await consoleCall(page, "console.document.update", { id: documentId, uploaded: true });

  const upload = async (name: string, body: Buffer | string) => {
    const bytes = Buffer.from(body);
    const res = await consoleCall(page, "console.documentUpload.create", { documentId, files: [{ name, size: bytes.length, sha256: sha(bytes) }] });
    expect((await page.request.put(data(res).uploads[0].url, { data: bytes })).status()).toBe(200);
  };
  const asset = (id: string, hash: string) => ({
    id, kind: "EMBEDDED", object: `assets/${id}.jpg`, display: `assets/${id}.display.webp`, format: "jpeg", pixels: [320, 180],
    sourceRange: { offset, length: embedded.length }, sha256: hash, placements: [],
  });
  const manifest = {
    version: 1, document: { documentId, sha256: sha(original), mediaType: "application/pdf", pages: 1 }, extractor: { name: "test", version: "1" },
    pages: [{ page: 1, size: [100, 100] }], segments: [{ id: "s001", page: 1, bbox: null, text: "One.", sentences: ["One."] }],
    assets: [asset("a01", sha(embedded)), asset("a02", "b".repeat(64))], modelInputs: [], warnings: [],
  };
  for (const id of ["a01", "a02"]) { await upload(`assets/${id}.jpg`, "jpeg"); await upload(`assets/${id}.display.webp`, "webp"); }
  await upload("manifest.v1.json", JSON.stringify(manifest));
  const key = `${account.institutionId}/${exhibition.id}/${documentId}/manifest.v1.json`;
  await consoleCall(page, "console.document.update", { id: documentId, manifestKey: key });

  const rows = () => e2eSql<{ manifest_asset_id: string; verification: string }>("SELECT manifest_asset_id, verification FROM images WHERE document_id = $1 ORDER BY manifest_asset_id", [documentId]);
  await expect.poll(async () => (await rows()).map((r) => r.verification), { timeout: 30_000 }).toEqual(["VERIFIED", "MISMATCH"]);

  // The MISMATCH image fails the preview check once the guide uses it.
  const [mismatch] = await e2eSql<{ id: string }>("SELECT id FROM images WHERE document_id = $1 AND verification = 'MISMATCH'", [documentId]);
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibition.id, JSON.stringify({ coverImageId: mismatch.id })]);
  const preview = data(await consoleCall(page, "console.preview.get", { code: exhibition.code }));
  expect(preview.checks.find((c: { id: string }) => c.id === "image-verification").ok).toBe(false);
});
