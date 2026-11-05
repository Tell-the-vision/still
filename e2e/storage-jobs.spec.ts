import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §10.10 storage.delete, §10.11 R2 객체 수명: deleting rows queues the object deletes in the same
// transaction; the worker removes the objects (R2_DRY_RUN=1: local files) and the job completes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const objectUrl = (key: string) => `/api/r2-dry-run/private-dry-run/${key}`;
const jobs = (singletonKey: string) =>
  e2eSql<{ state: string }>("SELECT state FROM pgboss.job WHERE name = 'storage.delete' AND singleton_key = $1", [singletonKey]);

async function uploadedDocument(page: import("@playwright/test").Page) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: "statement.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  });
  const document = data(created).document;
  expect((await page.request.put(data(created).upload.url, { data: original })).status()).toBe(200);
  await consoleCall(page, "console.document.update", { id: document.id, uploaded: true });
  const [{ object_key }] = await e2eSql<{ object_key: string }>("SELECT object_key FROM documents WHERE id = $1", [document.id]);
  return { account, exhibition, documentId: document.id as string, key: object_key };
}

test("deleting a document queues storage.delete; the original disappears and the job completes", async ({ page }) => {
  const { documentId, key } = await uploadedDocument(page);
  expect((await page.request.get(objectUrl(key))).status()).toBe(200);

  expect((await consoleCall(page, "console.document.delete", { id: documentId })).status).toBe(200);

  await expect.poll(async () => (await page.request.get(objectUrl(key))).status(), { timeout: 15_000 }).toBe(404);
  await expect.poll(async () => (await jobs(`private:${key}`))[0]?.state, { timeout: 15_000 }).toBe("completed");
});

test("deleting an exhibition queues its whole prefix", async ({ page }) => {
  const { account, exhibition, key } = await uploadedDocument(page);
  const prefix = `${account.institutionId}/${exhibition.id}/`;

  // The document is unreferenced, so only the exhibition delete remains to be exercised.
  expect((await consoleCall(page, "console.exhibition.delete", { code: exhibition.code })).status).toBe(200);

  await expect.poll(async () => (await jobs(`private:${prefix}`))[0]?.state, { timeout: 15_000 }).toBe("completed");
  expect((await page.request.get(objectUrl(key))).status()).toBe(404);
});
