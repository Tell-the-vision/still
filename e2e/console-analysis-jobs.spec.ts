import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.5 console.analysis.create / delete, §10.10: "Start analysis" queues a job that reads the manifest,
// asks the Worker (a fake one here, see playwright.config.ts) and stores the aligned contents.

test.use({ viewport: { width: 1440, height: 900 } });

const TEXT = "One two. Three.";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: any }) => res.json.result.data;

// Leaves one EXTRACTED document (via the API and the dry-run R2 store) in a new exhibition.
async function extractedExhibition(page: Page) {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const put = async (url: string, body: Buffer) => expect((await page.request.put(url, { data: body })).status()).toBe(200);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = data(await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: "statement.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  }));
  await put(created.upload.url, original);
  await consoleCall(page, "console.document.update", { id: created.document.id, uploaded: true });
  const manifest = Buffer.from(JSON.stringify({
    version: 1,
    document: { documentId: created.document.id, sha256: sha(original), mediaType: "application/pdf", pages: 1 },
    extractor: { name: "test", version: "1" },
    pages: [{ page: 1, size: [100, 100] }],
    segments: [{ id: "s001", page: 1, bbox: null, text: TEXT, sentences: ["One two.", "Three."] }],
    assets: [], modelInputs: [], warnings: [],
  }));
  const upload = await consoleCall(page, "console.documentUpload.create", {
    documentId: created.document.id, files: [{ name: "manifest.v1.json", size: manifest.length, sha256: sha(manifest) }],
  });
  await put(data(upload).uploads[0].url, manifest);
  const key = `${account.institutionId}/${exhibition.id}/${created.document.id}/manifest.v1.json`;
  const done = await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: key });
  expect(data(done).status).toBe("EXTRACTED");
  return { exhibition };
}

test("Start analysis fills the review screen with the manifest text", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials");
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page).toHaveURL(/\/materials\/review$/);
  await expect(page.getByText(TEXT)).toBeVisible({ timeout: 30_000 });
  const [row] = await e2eSql<{ result: string }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(row.result).toBe("SUCCEEDED");
});

test("create refuses a second run and an empty run; delete cancels", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);

  const empty = await consoleCall(page, "console.analysis.create", { code: exhibition.code });
  expect(empty.status).toBe(400);
  expect(empty.json.error.message).toBe("Nothing new to analyze.");

  await e2eSql("UPDATE exhibitions SET analysis = $2 WHERE id = $1", [exhibition.id, JSON.stringify({ id: randomUUID(), startedAt: new Date().toISOString(), documentIds: [], result: null, coverage: null, suggestions: [] })]);
  const busy = await consoleCall(page, "console.analysis.create", { code: exhibition.code });
  expect(busy.status).toBe(409);
  expect(busy.json.error.data.appCode).toBe("ANALYSIS_IN_PROGRESS");

  expect((await consoleCall(page, "console.analysis.delete", { code: exhibition.code })).status).toBe(200);
  const [row] = await e2eSql<{ result: string }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(row.result).toBe("CANCELLED");
});
