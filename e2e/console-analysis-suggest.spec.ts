import { expect, test } from "next/experimental/testmode/playwright";
import { consoleCall, e2eSql } from "./support/staff";
import { extractedExhibition } from "./support/analysis";

// SPEC §9.4 제안, §10.10 analysis.suggest: after an analysis the Worker's /suggest answer is stored as OPEN suggestions.

test("a finished analysis lists the Worker's suggestion as OPEN", async ({ page }) => {
  const { exhibition } = await extractedExhibition(page, "One -- two.");
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => (await e2eSql<{ n: number }>("SELECT count(*)::int AS n FROM contents WHERE exhibition_id = $1 AND suggestions @> '[{\"kind\":\"PUNCTUATION_CONSISTENCY\"}]'", [exhibition.id]))[0].n, { timeout: 30_000 }).toBe(1);
  const list = await consoleCall(page, "console.suggestion.list", { code: exhibition.code });
  const found = list.json.result.data.filter((s: { kind: string }) => s.kind === "PUNCTUATION_CONSISTENCY");
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ status: "OPEN", decidedBy: null, decidedAt: null, proposal: { from: "--", to: "—" } });
});
