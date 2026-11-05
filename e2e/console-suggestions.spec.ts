import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 편집 제안, §9.5 console.suggestion.list / update, §10.8 제안 수락·버리기.

test.use({ viewport: { width: 1440, height: 900 } });

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (id: string, value: string) => ({ type: "paragraph", attrs: { id }, content: [text(value)] });
const heading = (value: string) => ({ type: "heading", attrs: { id: "h1", level: 2 }, content: [text(value)] });
const suggestion = (id: string, kind: string, proposal?: string) => ({
  id, kind, target: { node: "b1" }, proposal: proposal ? { text: proposal } : {}, rationale: `${kind} rationale`,
  status: "OPEN", decidedBy: null, decidedAt: null,
});
const read = async (id: string) =>
  (await e2eSql<{ status: string; revision: string; doc: { content: { content?: { text: string }[] }[] }; suggestions: { id: string; status: string }[] }>(
    "SELECT status, revision, doc, suggestions FROM contents WHERE id = $1", [id]))[0];

test("accept applies the proposal and clears review; dismiss records; stale revision is refused", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const one = await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", doc: [heading("Alpha piece"), paragraph("b1", "Te Secret Show")] });
  const two = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [heading("Bravo piece"), paragraph("b1", "Second text")] });
  await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [one.id, JSON.stringify([suggestion("g1", "TEXT_EXTRACTION_FIX", "The Secret Show")])]);
  await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [two.id, JSON.stringify([suggestion("g2", "PUNCTUATION_CONSISTENCY")])]);
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");

  await page.locator(".item", { hasText: "Alpha piece" }).click();
  // The card sits inside the editor; in a wide column (preview hidden) it stands level with its block.
  const card = page.locator(".still-editor .suggestion--inline");
  await expect(card).toBeVisible();
  const blockBox = () => page.locator('.ProseMirror [data-id="b1"]').boundingBox();
  await expect.poll(async () => Math.abs((await card.boundingBox())!.y - (await blockBox())!.y)).toBeLessThan(4);
  const block = (await blockBox())!;
  expect((await card.boundingBox())!.x).toBeGreaterThanOrEqual(block.x + block.width);
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(card).toBeHidden();
  // The rich editor reopens on the new revision, so it shows the accepted text.
  await expect(page.locator(".ProseMirror")).toContainText("The Secret Show");
  const accepted = await read(one.id);
  expect(accepted.doc.content[1].content![0].text).toBe("The Secret Show");
  expect(accepted.status).toBe("READY");
  expect(accepted.suggestions[0].status).toBe("ACCEPTED");

  await page.locator(".item", { hasText: "Bravo piece" }).click();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(card).toBeHidden();
  expect((await read(two.id)).suggestions[0].status).toBe("DISMISSED");

  const stale = await consoleCall(page, "console.suggestion.update", { contentId: two.id, id: "g2", status: "ACCEPTED", revision: crypto.randomUUID() });
  expect(stale.json.error?.data?.appCode).toBe("REVISION_MISMATCH");
  const listed = await consoleCall(page, "console.suggestion.list", { code: exhibition.code });
  expect(listed.json.result.data.map((s: { id: string; status: string }) => `${s.id}:${s.status}`).sort()).toEqual(["g1:ACCEPTED", "g2:DISMISSED"]);
});
