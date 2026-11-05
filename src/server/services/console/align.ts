import type { StructureOutput } from "@still/shared/analysis-structure";
import type { ContentKind } from "@still/shared/console-content";
import type { Manifest } from "@still/shared/manifest";
import { stillDoc, type ContentFields, type ContentSources, type StillBlock, type StillDoc, type TextNode } from "@still/shared/still-doc";

// SPEC §9.1 (의도 보존), §9.4 구조화, §10.8 분석 결과 저장: the model's texts are compared with the manifest
// letter by letter (NFC, whitespace ignored, line-end hyphen splits joined). A text that matches is kept
// and its source range recorded; one that does not is replaced by the source text between its matched
// neighbours when that is clear, otherwise dropped. Pure and deterministic.

type SuggestionKind = "TEXT_MISMATCH" | "LABEL_GENERATED" | "IMAGE_NOT_FOUND";
export type AlignedSuggestion = { id: string; kind: SuggestionKind; target: Record<string, unknown>; proposal: Record<string, unknown>; rationale: string; status: "OPEN" };
export type AlignedContent = {
  kind: ContentKind;
  doc: StillDoc;
  sources: ContentSources;
  fields: ContentFields;
  suggestions: AlignedSuggestion[];
  status: "READY" | "NEEDS_REVIEW";
};
export type AlignResult = { contents: AlignedContent[]; coverage: { total: number; uncovered: number; refs: string[] } };

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

// Letters only: NFC, no whitespace, no hyphen that ends a line. `pos` maps every kept char to its index in `text`.
function normalize(text: string): { norm: string; pos: number[] } {
  let norm = "";
  const pos: number[] = [];
  let i = 0;
  for (const ch of text) {
    const at = i;
    i += ch.length;
    if (/\s/.test(ch)) continue;
    if (ch === "-" && /^-[^\S\n]*\n\s*\S/.test(text.slice(at))) continue;
    for (const part of ch.normalize("NFC")) {
      norm += part;
      pos.push(at);
    }
  }
  return { norm, pos };
}

type Range = { a: number; b: number }; // [a, b) in the normalized source
type Unit = { text: string; range: Range | null; replaced: boolean; heading: boolean; field: boolean };

export function alignStructure(args: { output: StructureOutput; documentId: string; manifest: Manifest; images: Record<string, string> }): AlignResult {
  const { output, documentId, manifest, images } = args;
  const segments = manifest.segments;
  const segStart: number[] = [];
  let joined = "";
  for (const s of segments) {
    segStart.push(joined.length + (joined ? 1 : 0));
    joined += (joined ? " " : "") + s.text;
  }
  const source = normalize(joined);

  // Pass 1: find every text. Document order searches forward from the previous match; fields search everywhere.
  const find = (text: string, from: number): Range | null => {
    const { norm } = normalize(text);
    if (!norm) return null;
    let a = source.norm.indexOf(norm, from);
    if (a < 0) a = source.norm.indexOf(norm);
    return a < 0 ? null : { a, b: a + norm.length };
  };
  const units: Unit[] = [];
  const unit = (text: string, opts: Partial<Unit> = {}): Unit => {
    const u: Unit = { text, range: null, replaced: false, heading: false, field: false, ...opts };
    units.push(u);
    return u;
  };
  const unitsByItem = output.items.map((item) => ({
    blocks: item.blocks.map((block) => {
      if (block.type === "bulletList" || block.type === "orderedList") return block.items.map((text) => unit(text));
      if (block.type === "stillImage") return [];
      return [unit(block.text, { heading: block.type === "heading" })];
    }),
    fields: Object.entries(item.fields).map(([name, value]) => [name, unit(value, { field: true })] as const),
  }));
  let cursor = 0;
  for (const u of units) {
    u.range = find(u.text, u.field ? 0 : cursor);
    if (u.range && !u.field && u.range.a >= cursor) cursor = u.range.b;
  }

  // Pass 2: an unmatched body text takes the source between its matched neighbours when it is the only one there.
  const flow = units.filter((u) => !u.field && !u.heading);
  const matchedFlow = flow.filter((u) => u.range);
  flow.forEach((u, i) => {
    if (u.range) return;
    const prev = flow.slice(0, i).reverse().find((p) => p.range);
    const next = flow.slice(i + 1).find((n) => n.range);
    const a = prev?.range?.b ?? 0;
    const b = next?.range?.a ?? source.norm.length;
    const rivals = flow.filter((o) => !o.range && flow.indexOf(o) !== i && (flow.slice(0, flow.indexOf(o)).reverse().find((p) => p.range) === prev));
    if (b <= a || rivals.length || (!prev && !next && matchedFlow.length)) return;
    u.range = { a, b };
    u.replaced = true;
    u.text = collapse(joined.slice(source.pos[a], source.pos[b - 1] + 1));
  });

  const refsOf = (r: Range) => {
    const start = source.pos[r.a];
    const end = source.pos[r.b - 1] + 1;
    const hit = segments.map((s, i) => i).filter((i) => segStart[i] < end && segStart[i] + segments[i].text.length > start);
    return { refs: hit.map((i) => `${documentId}:${segments[i].id}`), start: start - segStart[hit[0]], end: end - segStart[hit[0]] };
  };
  const spanOf = (list: Unit[]): Range | null => {
    const ranges = list.flatMap((u) => (u.range ? [u.range] : []));
    return ranges.length ? { a: Math.min(...ranges.map((r) => r.a)), b: Math.max(...ranges.map((r) => r.b)) } : null;
  };
  const text = (value: string): TextNode[] => (collapse(value) ? [{ type: "text", text: collapse(value) }] : []);

  // Pass 3: build the STILL nodes.
  const covered = new Set<string>();
  let nodeNo = 0;
  const contents = output.items.map((item, itemNo): AlignedContent => {
    const { blocks: blockUnits, fields: fieldUnits } = unitsByItem[itemNo];
    const content: StillBlock[] = [];
    const sources: ContentSources = {};
    const suggestions: AlignedSuggestion[] = [];
    const suggest = (kind: SuggestionKind, target: Record<string, unknown>, proposal: Record<string, unknown>, rationale: string) =>
      suggestions.push({ id: `g${suggestions.length + 1}`, kind, target, proposal, rationale, status: "OPEN" });
    const mismatch = (u: Unit, nodeId: string | null) =>
      suggest("TEXT_MISMATCH", nodeId ? { nodeId } : {}, { text: u.replaced ? u.text : collapse(u.text), modelText: u.replaced ? undefined : collapse(u.text) }, u.replaced ? "The model text differs from the source; replaced by the source text." : "The model text is not in the source; dropped.");
    if (item.label?.trim()) suggest("LABEL_GENERATED", {}, { text: item.label }, "The name of this section or theme is not in the source text; confirm it.");

    item.blocks.forEach((block, i) => {
      const us = blockUnits[i];
      const kept = us.filter((u) => u.range);
      const id = `n${++nodeNo}`;
      const placed = (list: Unit[]) => {
        const span = spanOf(list);
        if (span) {
          sources[id] = refsOf(span);
          sources[id].refs.forEach((r) => covered.add(r));
        }
      };
      if (block.type === "stillImage") {
        const imageId = images[block.imageId];
        if (!imageId) return suggest("IMAGE_NOT_FOUND", {}, { assetId: block.imageId }, "No stored image for this manifest asset id; the image block was dropped.");
        return void content.push({ type: "stillImage", attrs: { id, imageId, display: block.display, caption: block.caption } });
      }
      for (const u of us) if (!u.range || u.replaced) if (!u.heading || u.range) mismatch(u, u.range ? id : null);
      if (block.type === "heading") {
        const u = us[0];
        if (!u.range) suggest("LABEL_GENERATED", { nodeId: id }, { text: block.text }, "This heading is not in the source text; confirm it.");
        else placed([u]);
        return void content.push({ type: "heading", attrs: { id, level: block.level }, content: text(u.text) });
      }
      if (!kept.length) return;
      placed(kept);
      const paragraph = (u: Unit) => ({ type: "paragraph" as const, content: text(u.text) });
      if (block.type === "paragraph") content.push({ type: "paragraph", attrs: { id }, content: text(kept[0].text) });
      else if (block.type === "quote") content.push({ type: "blockquote", attrs: { id }, content: [paragraph(kept[0])] });
      else content.push({ type: block.type, attrs: { id }, content: kept.map((u) => ({ type: "listItem" as const, content: [paragraph(u)] })) });
    });

    const fields: ContentFields = {};
    for (const [name, u] of fieldUnits) {
      if (!u.range) {
        suggest("TEXT_MISMATCH", { field: name }, { modelText: collapse(u.text) }, "The field value is not in the source; dropped.");
        continue;
      }
      const { refs } = refsOf(u.range);
      fields[name] = { value: collapse(u.text), refs };
    }
    const status = suggestions.some((s) => s.kind === "TEXT_MISMATCH" || s.kind === "LABEL_GENERATED") ? "NEEDS_REVIEW" : "READY";
    return { kind: item.kind, doc: stillDoc.parse({ type: "doc", content }), sources, fields, suggestions, status };
  });

  const counted = segments.filter((s) => ["body", "list_item", "caption"].includes(s.role ?? "body"));
  const uncovered = counted.map((s) => `${documentId}:${s.id}`).filter((r) => !covered.has(r));
  return { contents, coverage: { total: counted.length, uncovered: uncovered.length, refs: uncovered } };
}
