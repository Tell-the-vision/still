import type { Manifest } from "@still/shared/manifest";
import type { StructureOutput } from "@still/shared/analysis-structure";
import { expect, test } from "next/experimental/testmode/playwright";
import { alignStructure } from "../src/server/services/console/align";

// SPEC §9.1 (의도 보존), §10.8 분석 결과 저장: model texts are aligned with the manifest letter by letter.

const DOC = "11111111-1111-4111-8111-111111111111";
const IMAGE = "22222222-2222-4222-8222-222222222222";
const seg = (id: string, text: string, role: string | null = "body") => ({ id, page: 1, bbox: null, text, role, sentences: [text] });
const manifest = (segments: ReturnType<typeof seg>[]) => ({ document: { documentId: DOC }, segments }) as unknown as Manifest;
type Block = StructureOutput["items"][number]["blocks"][number];
const output = (blocks: Block[], fields: Record<string, string> = {}, label: string | null = null) =>
  ({ items: [{ kind: "ARTWORK", label, blocks, fields, suggestions: [] }], outline: [], variants: [], usage: { model: "m", inputTokens: 0, outputTokens: 0 } }) as StructureOutput;
const para = (text: string): Block => ({ type: "paragraph", text });
const run = (blocks: Block[], segs: ReturnType<typeof seg>[], fields: Record<string, string> = {}, label: string | null = null) =>
  alignStructure({ output: output(blocks, fields, label), documentId: DOC, manifest: manifest(segs), images: { a01: IMAGE } });
const kinds = (r: ReturnType<typeof run>) => r.contents[0].suggestions.map((s) => s.kind);
const textOf = (r: ReturnType<typeof run>, i = 0) => JSON.stringify(r.contents[0].doc.content[i]);

const segs = [seg("s001", "The first paragraph."), seg("s002", "The second one is here."), seg("s003", "A third closes it.")];

test("whitespace-only differences match and keep the model text", () => {
  const r = run([para("The  first\nparagraph."), para("The second one is here.")], segs);
  expect(r.contents[0].status).toBe("READY");
  expect(r.contents[0].sources.n1).toEqual({ refs: [`${DOC}:s001`], start: 0, end: 20 });
  expect(textOf(r)).toContain("The first paragraph.");
});

test("a changed word is replaced by the source with TEXT_MISMATCH", () => {
  const r = run([para("The first paragraph."), para("The second ONE is here."), para("A third closes it.")], segs);
  expect(textOf(r, 1)).toContain("The second one is here.");
  expect(kinds(r)).toEqual(["TEXT_MISMATCH"]);
  expect(r.contents[0].status).toBe("NEEDS_REVIEW");
  expect(r.contents[0].sources.n2.refs).toEqual([`${DOC}:s002`]);
});

test("an invented paragraph is dropped with TEXT_MISMATCH", () => {
  const r = run([para("The first paragraph."), para("Something invented."), para("The second one is here.")], segs);
  expect(r.contents[0].doc.content).toHaveLength(2);
  expect(kinds(r)).toEqual(["TEXT_MISMATCH"]);
});

test("a heading without a match is kept with LABEL_GENERATED; a label too", () => {
  const r = run([{ type: "heading", level: 2, text: "Invented title" }, para("The first paragraph.")], segs, {}, "Room one");
  expect(r.contents[0].doc.content).toHaveLength(2);
  expect(kinds(r)).toEqual(["LABEL_GENERATED", "LABEL_GENERATED"]);
  expect(r.contents[0].status).toBe("NEEDS_REVIEW");
});

test("a line-end hyphen split matches the whole word", () => {
  const r = run([para("An example text.")], [seg("s001", "An exam-\nple text.")]);
  expect(kinds(r)).toEqual([]);
  expect(r.contents[0].sources.n1.refs).toEqual([`${DOC}:s001`]);
});

test("an out-of-order block still matches", () => {
  const r = run([para("A third closes it."), para("The first paragraph.")], segs);
  expect(kinds(r)).toEqual([]);
  expect(r.contents[0].sources.n2.refs).toEqual([`${DOC}:s001`]);
});

test("images map to stored ids; unknown ones are dropped with a suggestion; fields align", () => {
  const image = (imageId: string): Block => ({ type: "stillImage", imageId, display: "HERO", caption: null });
  const r = run([image("a01"), image("a09")], segs, { year: "second one", bogus: "nowhere" });
  expect(textOf(r)).toContain(IMAGE);
  expect(r.contents[0].doc.content).toHaveLength(1);
  expect(kinds(r).sort()).toEqual(["IMAGE_NOT_FOUND", "TEXT_MISMATCH"]);
  expect(Object.keys(r.contents[0].fields)).toEqual(["year"]);
});

test("coverage lists body segments no source range reaches", () => {
  const all = [...segs, seg("s004", "Page 4", "page_number")];
  const r = run([para("The first paragraph.")], all);
  expect(r.coverage).toEqual({ total: 3, uncovered: 2, refs: [`${DOC}:s002`, `${DOC}:s003`] });
});

test("the same input gives the same result", () => {
  const blocks = [para("The first paragraph."), para("nope"), { type: "bulletList", items: ["A third closes it."] } as Block];
  expect(run(blocks, segs)).toEqual(run(blocks, segs));
});
