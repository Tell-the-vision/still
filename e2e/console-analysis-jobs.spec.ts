import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { extractedExhibition } from "./support/analysis";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.5 console.analysis.create / delete, §10.10: "Start analysis" queues a job that reads the manifest,
// asks the Worker (a fake one here, see playwright.config.ts) and stores the aligned contents.

test.use({ viewport: { width: 1440, height: 900 } });

const TEXT = "One two. Three.";

test("Start analysis fills the review screen with the manifest text", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page, TEXT);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials");
  await page.getByRole("button", { name: "Start analysis" }).click();
  await expect(page).toHaveURL(/\/materials\/review$/);
  await expect(page.getByRole("textbox", { name: "Item text" }).getByText(TEXT)).toBeVisible({ timeout: 30_000 });
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
