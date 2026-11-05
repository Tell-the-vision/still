import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 진행 표시, §9.5 console.analysis.get (Figma A3): the overview's processing history is
// read from exhibitions.analysis and the document / content states until pg-boss exists.

test.use({ viewport: { width: 1440, height: 900 } });

// A valid documents row for `status` (SPEC §10.6: FAILED has an error code, EXTRACTED a manifest).
async function seedDocument(exhibitionId: string, status: string) {
  const key = randomUUID();
  await e2eSql(
    `INSERT INTO documents (exhibition_id, object_key, original_name, media_type, byte_size, sha256, status, error_code, manifest_object_key)
     VALUES ($1, $2, 'notes.txt', 'text/plain', 10, $3, $4, $5, $6)`,
    [exhibitionId, `e2e/${key}`, "a".repeat(64), status, status === "FAILED" ? "CORRUPTED" : null, status === "EXTRACTED" ? `e2e/${key}.manifest` : null],
  );
}

async function openOverview(page: Page, account: InstitutionAccount, title: string) {
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/overview$/);
}

const step = (page: Page, title: string) => page.getByRole("row").filter({ hasText: title });

test("the overview shows every step as pending while the exhibition has no documents", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await openOverview(page, account, exhibition.title);

  for (const title of ["Upload", "Text extraction", "Content classification", "Curator review"]) {
    await expect(step(page, title)).toContainText("Pending");
  }
});

test("stored documents complete the upload step and leave text extraction pending", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedDocument(exhibition.id, "STORED");
  await openOverview(page, account, exhibition.title);

  await expect(step(page, "Upload")).toContainText("Complete");
  await expect(step(page, "Text extraction")).toContainText("Pending");
  await expect(step(page, "Content classification")).toContainText("Pending");
});

test("a failed analysis shows content classification as failed", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedDocument(exhibition.id, "EXTRACTED");
  const analysis = { id: randomUUID(), startedAt: new Date().toISOString(), documentIds: [], result: "FAILED", coverage: null, suggestions: [] };
  await e2eSql("UPDATE exhibitions SET analysis = $1 WHERE id = $2", [JSON.stringify(analysis), exhibition.id]);
  await openOverview(page, account, exhibition.title);

  await expect(step(page, "Text extraction")).toContainText("Complete");
  await expect(step(page, "Content classification")).toContainText("Failed");
});

test("console.analysis.get counts documents and contents, and hides other institutions' codes", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  for (const status of ["STORED", "STORED", "EXTRACTED", "FAILED"]) await seedDocument(exhibition.id, status);
  const other = await seedExhibition(await seedInstitutionAccount());
  await signInConsole(page, account);

  const got = await consoleCall(page, "console.analysis.get", { code: exhibition.code });
  expect(got.json.result.data).toEqual({
    analysis: null,
    documents: { total: 4, uploading: 0, stored: 2, extracted: 1, failed: 1, duplicate: 0 },
    contents: { total: 0, open: 0 },
    jobs: [],
  });
  expect((await consoleCall(page, "console.analysis.get", { code: other.code })).status).toBe(404);
});
