import { expect, test } from "next/experimental/testmode/playwright";
import { extractedExhibition } from "./support/analysis";
import { consoleCall, e2eSql } from "./support/staff";

const resultOf = async (exhibitionId: string) =>
  (await e2eSql<{ result: string | null }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibitionId]))[0].result;

// One long analysis (the fake Worker holds "SLOW" text for 20s) must not hold another exhibition's
// analysis behind it on the same server.
test("an analysis finishes while another exhibition's slow analysis is still running", async ({ browser }) => {
  const slowPage = await browser.newPage();
  const quickPage = await browser.newPage();
  const slow = await extractedExhibition(slowPage, "SLOW catalogue text.");
  const quick = await extractedExhibition(quickPage, "Quick catalogue text.");
  expect((await consoleCall(slowPage, "console.analysis.create", { code: slow.exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await e2eSql<{ n: number }>("SELECT count(*)::int AS n FROM pgboss.job WHERE name = 'analysis.run' AND state = 'active' AND data->>'exhibitionId' = $1", [slow.exhibition.id]))[0].n, { timeout: 10_000 }).toBe(1);
  expect((await consoleCall(quickPage, "console.analysis.create", { code: quick.exhibition.code })).status).toBe(200);
  await expect.poll(() => resultOf(quick.exhibition.id), { timeout: 12_000 }).toBe("SUCCEEDED");
  expect(await resultOf(slow.exhibition.id)).toBeNull(); // still running
});
