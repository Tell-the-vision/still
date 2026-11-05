import type { StructureResponse } from "@still/shared/analysis-worker";
import type { ContentBlock, ContentKind, ContentStatus } from "@still/shared/console-content";
import type { SECTION_KINDS } from "@still/shared/console-draft";
import type { Manifest } from "@still/shared/manifest";

// SPEC §9.1 (의도 보존), §10.8 쓰기 경로 (analysis.finalize): turns the Worker's reference-only structure into
// contents. Pure: no database, clock or network. The one rule everything here serves is that block text and
// field values are copied from the manifest; nothing the model wrote (except a label, kept as a suggestion)
// reaches a block or a field.

export type FinalizeDocuments = Record<string, { documentId: string; manifest: Manifest }>; // by alias ("d1")
export type FinalizeImages = Record<string, string>; // "{documentId}:{assetId}" → images.id

type SuggestionKind = "INVALID_REFERENCE" | "LABEL_GENERATED";
export type FinalizedSuggestion = {
  id: string;
  kind: SuggestionKind;
  target: Record<string, unknown>;
  proposal: Record<string, unknown>;
  rationale: string;
  status: "OPEN";
  decidedBy: null;
  decidedAt: null;
};
export type FinalizedContent = {
  kind: ContentKind;
  status: Extract<ContentStatus, "READY" | "NEEDS_REVIEW">;
  blocks: ContentBlock[];
  fields: Record<string, { value: string; origin: "SOURCE"; refs: string[] }> | null;
  suggestions: FinalizedSuggestion[];
};
export type FinalizeResult = {
  contents: FinalizedContent[];
  skipped: number; // items that ended up with no blocks and no fields
  coverage: { total: number; uncovered: number; refs: string[] };
  outline: { section: (typeof SECTION_KINDS)[number]; title: string | null; contentIndexes: number[] }[];
};

// finalizeStructure({ outputs, documents, images }): `outputs` are the validated structure responses of one
// analysis in chunk order; `documents` maps each alias to its document and manifest; `images` maps
// "{documentId}:{assetId}" to the images row of that asset.
export function finalizeStructure(input: { outputs: StructureResponse[]; documents: FinalizeDocuments; images: FinalizeImages }): FinalizeResult {
  const { outputs, documents, images } = input;

  // A model ref ("d1:s014", "d1:s015.3") resolved against the manifests, or null if it names nothing.
  function resolve(ref: string) {
    const match = /^(d\d+):(s\d+)(?:\.(\d+))?$/.exec(ref);
    const doc = match && documents[match[1]];
    const segment = doc && doc.manifest.segments.find((s) => s.id === match[2]);
    if (!match || !doc || !segment) return null;
    const sentenceNo = match[3] === undefined ? null : Number(match[3]);
    if (sentenceNo !== null && !(sentenceNo >= 1 && sentenceNo <= segment.sentences.length)) return null;
    const text = sentenceNo === null ? segment.text : segment.sentences[sentenceNo - 1];
    return { stored: `${doc.documentId}:${segment.id}${sentenceNo === null ? "" : `.${sentenceNo}`}`, text };
  }

  // All refs resolved, or null if any is unknown.
  function resolveAll(refs: string[]) {
    const resolved = refs.map(resolve);
    return resolved.every((r) => r !== null) ? resolved : null;
  }

  const contents: FinalizedContent[] = [];
  const outline: FinalizeResult["outline"] = [];
  const covered = new Set<string>(); // stored refs, as the blocks and fields carry them
  let skipped = 0;

  for (const output of outputs) {
    const positionOfKey = new Map<string, number>();

    for (const item of output.items) {
      const blocks: ContentBlock[] = [];
      const fields: NonNullable<FinalizedContent["fields"]> = {};
      const suggestions: FinalizedSuggestion[] = [];
      const suggest = (kind: SuggestionKind, target: Record<string, unknown>, proposal: Record<string, unknown>, rationale: string) =>
        suggestions.push({ id: `g${suggestions.length + 1}`, kind, target, proposal, rationale, status: "OPEN", decidedBy: null, decidedAt: null });
      const nextId = () => `b${blocks.length + 1}`;

      item.blocks.forEach((block, index) => {
        if (block.type === "image") {
          const [alias, assetId] = block.asset.split(":");
          const imageId = documents[alias] && images[`${documents[alias].documentId}:${assetId}`];
          const captions = resolveAll(block.captionRefs);
          if (!imageId || !captions) return suggest("INVALID_REFERENCE", { asset: block.asset, blockIndex: index }, {}, "The image or its caption points to something the documents do not contain; the block was dropped.");
          captions.forEach((c) => covered.add(c.stored));
          blocks.push({ id: nextId(), type: "image", imageId, display: block.display, captionRefs: captions.map((c) => c.stored) });
          return;
        }
        const resolved = resolveAll(block.refs);
        if (!resolved) return suggest("INVALID_REFERENCE", { blockIndex: index, refs: block.refs }, {}, "The block points to source text that does not exist; it was dropped.");
        resolved.forEach((r) => covered.add(r.stored));
        blocks.push({ id: nextId(), type: block.type, text: resolved.map((r) => r.text).join(" "), origin: "SOURCE", refs: resolved.map((r) => r.stored) });
      });

      for (const [name, ref] of Object.entries(item.fields)) {
        const resolved = resolve(ref);
        if (!resolved) {
          suggest("INVALID_REFERENCE", { field: name, ref }, {}, "The field points to source text that does not exist; it was dropped.");
          continue;
        }
        covered.add(resolved.stored);
        fields[name] = { value: resolved.text, origin: "SOURCE", refs: [resolved.stored] };
      }

      // A label is text the source does not contain: it never enters a block, a person confirms it (SPEC §9.4).
      if (item.label?.trim()) suggest("LABEL_GENERATED", {}, { text: item.label }, "The name of this section or theme is not in the source text; confirm it.");

      if (blocks.length === 0 && Object.keys(fields).length === 0) {
        skipped += 1;
        continue;
      }
      positionOfKey.set(item.key, contents.length);
      contents.push({ kind: item.kind, status: suggestions.length ? "NEEDS_REVIEW" : "READY", blocks, fields: Object.keys(fields).length ? fields : null, suggestions });
    }

    for (const section of output.outline) {
      const contentIndexes = section.items.flatMap((key) => positionOfKey.get(key) ?? []);
      outline.push({ section: section.section, title: section.title, contentIndexes });
    }
  }

  return { contents, skipped, coverage: coverageOf(documents, covered), outline };
}

// 누락 계산 (SPEC §9.1-5, §10.8): sentences of body, list_item and caption segments (no role counts as body)
// that no content refers to, directly or through its segment.
const COUNTED_ROLES = new Set(["body", "list_item", "caption"]);

function coverageOf(documents: FinalizeDocuments, covered: Set<string>): FinalizeResult["coverage"] {
  let total = 0;
  const refs: string[] = [];
  for (const { documentId, manifest } of Object.values(documents)) {
    for (const segment of manifest.segments) {
      if (!COUNTED_ROLES.has(segment.role ?? "body")) continue;
      total += segment.sentences.length;
      const segmentRef = `${documentId}:${segment.id}`;
      segment.sentences.forEach((_, i) => {
        const sentenceRef = `${segmentRef}.${i + 1}`;
        if (!covered.has(segmentRef) && !covered.has(sentenceRef)) refs.push(sentenceRef);
      });
    }
  }
  return { total, uncovered: refs.length, refs };
}
