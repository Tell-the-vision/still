import { randomUUID } from "node:crypto";
import type { Manifest } from "@still/shared/manifest";
import type { StructureResponse } from "@still/shared/analysis-worker";
import { expect, test } from "next/experimental/testmode/playwright";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { E2E_DB_ENV } from "../playwright.config";
import * as schema from "../src/server/db/schema";
import { finalizeStructure, type FinalizeResult } from "../src/server/services/console/finalize";
import { writeFinalizedContents } from "../src/server/services/console/finalize-write";
import { seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount } from "./support/staff";

// SPEC §9.1 (의도 보존), §10.8 쓰기 경로 (analysis.finalize): the Worker's reference-only structure becomes
// contents whose text comes from the manifest alone.

const DOC = "11111111-1111-4111-8111-111111111111";
const seg = (id: string, text: string, sentences: string[], role: string | null = "body") => ({ id, page: 1, bbox: null, text, role, sentences });
const manifest = {
  version: 1,
  document: { documentId: DOC, sha256: "a".repeat(64), mediaType: "application/pdf", pages: 1 },
  extractor: { name: "t", version: "1" },
  pages: [],
  segments: [
    seg("s001", "About the Artist", ["About the Artist"], "heading"),
    seg("s002", "An ascetic recluse. He paints at night.", ["An ascetic recluse.", "He paints at night."]),
    seg("s003", "Oil on canvas", ["Oil on canvas"], "caption"),
    seg("s004", "Page 7", ["Page 7"], "page_number"),
    seg("s005", "Untitled, 2020", ["Untitled, 2020"], null),
  ],
  assets: [],
  modelInputs: [],
  warnings: [],
} as unknown as Manifest;
const documents = { d1: { documentId: DOC, manifest } };
const images = { [`${DOC}:a01`]: "22222222-2222-4222-8222-222222222222" };

const usage = { model: "m", inputTokens: 1, outputTokens: 1 };
const output = (items: StructureResponse["items"], outline: StructureResponse["outline"] = []): StructureResponse => ({ items, outline, usage });
const item = (key: string, over: Partial<StructureResponse["items"][number]> = {}) => ({ key, kind: "ARTIST" as const, blocks: [], fields: {}, label: null, ...over });
const run = (items: StructureResponse["items"], outline: StructureResponse["outline"] = []) => finalizeStructure({ outputs: [output(items, outline)], documents, images });

test("block text is copied verbatim from segments and sentences", () => {
  const { contents } = run([
    item("i1", {
      blocks: [
        { type: "heading", refs: ["d1:s001"] },
        { type: "paragraph", refs: ["d1:s001", "d1:s002"] },
        { type: "sentence", refs: ["d1:s002.2"] },
        { type: "sentence", refs: ["d1:s005"] },
      ],
    }),
  ]);
  expect(contents).toHaveLength(1);
  expect(contents[0].status).toBe("READY");
  expect(contents[0].suggestions).toEqual([]);
  expect(contents[0].blocks).toEqual([
    { id: "b1", type: "heading", text: "About the Artist", origin: "SOURCE", refs: [`${DOC}:s001`] },
    { id: "b2", type: "paragraph", text: "About the Artist An ascetic recluse. He paints at night.", origin: "SOURCE", refs: [`${DOC}:s001`, `${DOC}:s002`] },
    { id: "b3", type: "sentence", text: "He paints at night.", origin: "SOURCE", refs: [`${DOC}:s002.2`] },
    { id: "b4", type: "sentence", text: "Untitled, 2020", origin: "SOURCE", refs: [`${DOC}:s005`] },
  ]);
});

test("a block with an unknown reference is dropped and flagged INVALID_REFERENCE", () => {
  const { contents } = run([
    item("i1", {
      blocks: [
        { type: "paragraph", refs: ["d1:s002"] },
        { type: "paragraph", refs: ["d1:s002", "d1:s999"] },
        { type: "sentence", refs: ["d1:s002.3"] },
        { type: "heading", refs: ["d9:s001"] },
      ],
    }),
  ]);
  expect(contents[0].blocks.map((b) => b.id)).toEqual(["b1"]);
  expect(contents[0].status).toBe("NEEDS_REVIEW");
  expect(contents[0].suggestions.map((s) => [s.id, s.kind, s.status, s.decidedBy, s.decidedAt])).toEqual([
    ["g1", "INVALID_REFERENCE", "OPEN", null, null],
    ["g2", "INVALID_REFERENCE", "OPEN", null, null],
    ["g3", "INVALID_REFERENCE", "OPEN", null, null],
  ]);
});

test("a label becomes a LABEL_GENERATED suggestion and appears in no block", () => {
  const { contents } = run([item("i1", { label: "Night Works", blocks: [{ type: "paragraph", refs: ["d1:s002"] }] })]);
  expect(contents[0].status).toBe("NEEDS_REVIEW");
  expect(contents[0].suggestions).toMatchObject([{ kind: "LABEL_GENERATED", proposal: { text: "Night Works" }, status: "OPEN" }]);
  expect(JSON.stringify([contents[0].blocks, contents[0].fields])).not.toContain("Night Works");
});

test("fields take the referenced segment's text; an unknown ref drops the field", () => {
  const { contents } = run([
    item("i1", { kind: "ARTWORK", fields: { titleEn: "d1:s005", medium: "d1:s003", year: "d1:s404" } }),
  ]);
  expect(contents).toHaveLength(1);
  expect(contents[0].fields).toEqual({
    titleEn: { value: "Untitled, 2020", origin: "SOURCE", refs: [`${DOC}:s005`] },
    medium: { value: "Oil on canvas", origin: "SOURCE", refs: [`${DOC}:s003`] },
  });
  expect(contents[0].blocks).toEqual([]);
  expect(contents[0].suggestions).toMatchObject([{ kind: "INVALID_REFERENCE", target: { field: "year" } }]);
  expect(contents[0].status).toBe("NEEDS_REVIEW");
});

test("image assets map to imageId; an unknown asset is dropped", () => {
  const { contents } = run([
    item("i1", {
      blocks: [
        { type: "image", asset: "d1:a01", display: "PORTRAIT", captionRefs: ["d1:s003"] },
        { type: "image", asset: "d1:a02", display: "INLINE", captionRefs: [] },
        { type: "paragraph", refs: ["d1:s002"] },
      ],
    }),
  ]);
  expect(contents[0].blocks).toEqual([
    { id: "b1", type: "image", imageId: images[`${DOC}:a01`], display: "PORTRAIT", captionRefs: [`${DOC}:s003`] },
    { id: "b2", type: "paragraph", text: "An ascetic recluse. He paints at night.", origin: "SOURCE", refs: [`${DOC}:s002`] },
  ]);
  expect(contents[0].suggestions).toMatchObject([{ kind: "INVALID_REFERENCE", target: { asset: "d1:a02" } }]);
});

test("an item with no blocks and no fields is skipped and counted", () => {
  const result = run([item("i1"), item("i2", { blocks: [{ type: "paragraph", refs: ["d1:s999"] }] }), item("i3", { blocks: [{ type: "paragraph", refs: ["d1:s002"] }] })]);
  expect(result.contents).toHaveLength(1);
  expect(result.skipped).toBe(2);
});

test("coverage counts uncovered body, list_item and caption sentences", () => {
  // s001 heading and s004 page_number are not counted; s005 has no role and counts as body.
  const covered = run([item("i1", { blocks: [{ type: "paragraph", refs: ["d1:s002"] }, { type: "sentence", refs: ["d1:s005"] }] })]);
  expect(covered.coverage).toEqual({ total: 4, uncovered: 1, refs: [`${DOC}:s003.1`] });

  const partial = run([item("i1", { blocks: [{ type: "sentence", refs: ["d1:s002.1"] }, { type: "image", asset: "d1:a01", display: "INLINE", captionRefs: ["d1:s003"] }] })]);
  expect(partial.coverage).toEqual({ total: 4, uncovered: 2, refs: [`${DOC}:s002.2`, `${DOC}:s005.1`] });
});

test("outline maps item keys to content positions and skips dropped items", () => {
  const { outline } = run(
    [item("i1"), item("i2", { blocks: [{ type: "paragraph", refs: ["d1:s002"] }] }), item("i3", { blocks: [{ type: "paragraph", refs: ["d1:s005"] }] })],
    [{ section: "ARTIST", title: null, items: ["i1", "i2", "i3"] }],
  );
  expect(outline).toEqual([{ section: "ARTIST", title: null, contentIndexes: [0, 1] }]);
});

test("the same inputs give the same output", () => {
  const items = [item("i1", { label: "L", blocks: [{ type: "paragraph", refs: ["d1:s002"] }, { type: "paragraph", refs: ["d1:s9"] }] })];
  expect(run(items)).toEqual(run(items));
});

test("writeFinalizedContents inserts contents once and leaves other analysis keys alone", async () => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const analysisId = randomUUID();
  const [doc] = await e2eSql<{ id: string }>(
    `INSERT INTO documents (exhibition_id, object_key, original_name, media_type, byte_size, sha256, status)
     VALUES ($1, $2, 'a.txt', 'text/plain', 1, $3, 'STORED') RETURNING id`,
    [exhibition.id, `e2e/${randomUUID()}`, "b".repeat(64)],
  );
  const analysis = { id: analysisId, startedAt: "2026-01-01T00:00:00.000Z", documentIds: [doc.id], result: null, coverage: null, suggestions: [] };
  await e2eSql("UPDATE exhibitions SET analysis = $1 WHERE id = $2", [JSON.stringify(analysis), exhibition.id]);
  const [existing] = await e2eSql<{ id: string }>(
    "INSERT INTO contents (exhibition_id, kind, status, blocks) VALUES ($1, 'OTHER', 'READY', '[]') RETURNING id",
    [exhibition.id],
  );

  const result: FinalizeResult = run([
    item("i1", { label: "Night", blocks: [{ type: "paragraph", refs: ["d1:s002"] }] }),
    item("i2", { kind: "ARTWORK", fields: { titleEn: "d1:s005" } }),
  ], [{ section: "ARTIST", title: null, items: ["i1", "i2"] }]);

  const pool = new Pool({ connectionString: E2E_DB_ENV.DATABASE_URL });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  try {
    const input = { exhibitionId: exhibition.id, analysisId, documentIds: [doc.id], result };
    expect(await db.transaction((tx) => writeFinalizedContents(tx, input))).toEqual({ written: true });
    expect(await db.transaction((tx) => writeFinalizedContents(tx, input))).toEqual({ written: false });
  } finally {
    await pool.end();
  }

  const rows = await e2eSql<{ id: string; kind: string; status: string }>("SELECT id, kind, status FROM contents WHERE exhibition_id = $1 ORDER BY created_at, kind", [exhibition.id]);
  expect(rows).toHaveLength(3);
  expect(rows.find((r) => r.id === existing.id)).toMatchObject({ kind: "OTHER", status: "READY" });
  expect(rows.filter((r) => r.id !== existing.id).map((r) => [r.kind, r.status]).sort()).toEqual([["ARTIST", "NEEDS_REVIEW"], ["ARTWORK", "READY"]]);

  const [after] = await e2eSql<{ analysis: Record<string, unknown> }>("SELECT analysis FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(after.analysis).toMatchObject({ id: analysisId, startedAt: analysis.startedAt, documentIds: [doc.id], coverage: result.coverage, outline: result.outline });
  expect(typeof after.analysis.finalizedAt).toBe("string");
  const [docRow] = await e2eSql<{ analyzed_at: Date | null }>("SELECT analyzed_at FROM documents WHERE id = $1", [doc.id]);
  expect(docRow.analyzed_at).not.toBeNull();
});
