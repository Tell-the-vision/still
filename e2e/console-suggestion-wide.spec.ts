import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §10.8 제안 수락·버리기: an exhibition-wide suggestion lives in exhibitions.analysis.suggestions.

test.use({ viewport: { width: 1440, height: 900 } });

const paragraph = (value: string) => ({ type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: value }] });
const heading = (value: string) => ({ type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: value }] });
const wide = (id: string, items: { contentId: string; node: string }[]) => ({
  id, kind: "TEXT_EXTRACTION_FIX", target: { items }, proposal: { text: "Fixed text." }, rationale: "Same typo in both items",
  status: "OPEN", decidedBy: null, decidedAt: null,
});

test("accepting an exhibition-wide suggestion fixes its items; stale revision is refused; focus returns to the heading", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const a = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [heading("Alpha piece"), paragraph("Typo one")] });
  const b = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [heading("Bravo piece"), paragraph("Typo two")] });
  const suggestions = [wide("w1", [{ contentId: a.id, node: "b1" }, { contentId: b.id, node: "b1" }]), wide("w2", [])];
  await e2eSql("UPDATE exhibitions SET analysis = $2 WHERE id = $1", [exhibition.id, JSON.stringify({ suggestions })]);
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");

  const section = page.getByRole("region", { name: "Exhibition-wide suggestions" });
  await expect(section.locator(".suggestion")).toHaveCount(2);
  await section.getByRole("button", { name: "Accept" }).first().click();
  await expect(section.locator(".suggestion")).toHaveCount(1);
  // Focus moved to the remaining suggestion's Accept button.
  await expect(section.getByRole("button", { name: "Accept" })).toBeFocused();

  const text = async (id: string) =>
    (await e2eSql<{ doc: { content: { content?: { text: string }[] }[] } }>("SELECT doc FROM contents WHERE id = $1", [id]))[0].doc.content[1].content![0].text;
  expect(await text(a.id)).toBe("Fixed text.");
  expect(await text(b.id)).toBe("Fixed text.");
  const [row] = await e2eSql<{ analysis: { suggestions: { id: string; status: string }[] } }>("SELECT analysis FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(row.analysis.suggestions.map((s) => `${s.id}:${s.status}`)).toEqual(["w1:ACCEPTED", "w2:OPEN"]);

  const stale = await consoleCall(page, "console.suggestion.update", { code: exhibition.code, id: "w2", status: "ACCEPTED", revision: crypto.randomUUID() });
  expect(stale.json.error?.data?.appCode).toBe("REVISION_MISMATCH");

  await section.getByRole("button", { name: "Dismiss" }).click();
  await expect(section.locator(".suggestion")).toHaveCount(0);
  await expect(section.getByRole("heading", { name: "Exhibition-wide suggestions" })).toBeFocused();
});
