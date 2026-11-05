import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §10.8 제안 수락·버리기, from the review of #41: a suggestion is decided once (a second accept
// applied the edit again), and PUNCTUATION_CONSISTENCY counts code points, so an emoji before the
// punctuation does not shift the replacement. Nested targets and lost targets are #124 (PR #135).

test.use({ viewport: { width: 1440, height: 900 } });

const paragraph = (id: string, text: string) => ({ type: "paragraph", attrs: { id }, content: [{ type: "text", text }] });
const suggestion = (id: string, kind: string, node: string, proposal: unknown) => ({
  id, kind, target: { node }, proposal, rationale: kind, status: "OPEN", decidedBy: null, decidedAt: null,
});
type Block = { type: string; attrs: { id: string }; content?: { text: string }[] };
const read = async (id: string) =>
  (await e2eSql<{ doc: { content: Block[] }; suggestions: { id: string; status: string }[] }>("SELECT doc, suggestions FROM contents WHERE id = $1", [id]))[0];
const textOf = (block: Block | undefined) => (block?.content ?? []).map((r) => r.text).join("");

test("a suggestion is decided once; punctuation is replaced correctly after an emoji", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const item = await seedContent(exhibition, {
    kind: "ARTWORK", status: "READY",
    doc: [paragraph("top", "Body"), paragraph("punct", "Colour 🎨 --- and form --- here")],
  });
  const suggestions = [
    suggestion("a", "MISSING_HEADING", "top", { text: "Intro", level: 2 }),
    suggestion("b", "PUNCTUATION_CONSISTENCY", "punct", { from: "---", to: "—" }),
  ];
  await e2eSql("UPDATE contents SET suggestions = $2 WHERE id = $1", [item.id, JSON.stringify(suggestions)]);
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");

  const decide = async (id: string, status: "ACCEPTED" | "DISMISSED") => {
    const listed = await consoleCall(page, "console.suggestion.list", { code: exhibition.code });
    const revision = listed.json.result.data.find((s: { id: string }) => s.id === id).revision;
    return consoleCall(page, "console.suggestion.update", { contentId: item.id, id, status, revision });
  };

  // Decided once: a second decision of "a" is a CONFLICT and the heading is not inserted twice.
  expect((await decide("a", "ACCEPTED")).json.error).toBeUndefined();
  expect((await decide("a", "ACCEPTED")).status).toBe(409);
  expect((await decide("a", "DISMISSED")).status).toBe(409);
  const headings = (await read(item.id)).doc.content.filter((b) => b.type === "heading");
  expect(headings).toHaveLength(1);
  expect(textOf(headings[0])).toBe("Intro");

  // Both "---" become "—", the one after the emoji included.
  expect((await decide("b", "ACCEPTED")).json.error).toBeUndefined();
  const { doc, suggestions: decided } = await read(item.id);
  expect(textOf(doc.content.find((b) => b.attrs.id === "punct"))).toBe("Colour 🎨 — and form — here");
  expect(decided.map((s) => `${s.id}:${s.status}`)).toEqual(["a:ACCEPTED", "b:ACCEPTED"]);
});
