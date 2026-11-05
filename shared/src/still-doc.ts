import { z } from "zod";

// The STILL schema (SPEC §9.4 편집기, §10.8, §11.8): one Tiptap document format for item bodies in the
// console, the published guide and the description. Plain text only; the one mark is `scrap` (a
// sentence visitors can keep). Visitors render it with the STILL renderer, never with Tiptap.

export const IMAGE_DISPLAYS = ["HERO", "GALLERY", "INLINE", "PORTRAIT"] as const;
export const MAX_NODES = 500; // SPEC §10.8 implementation default

const id = z.string().min(1).max(64);

export const scrapMark = z.strictObject({ type: z.literal("scrap"), attrs: z.strictObject({ sentenceId: z.uuid().nullable() }) });
export const textNode = z.strictObject({ type: z.literal("text"), text: z.string().min(1), marks: z.array(scrapMark).max(1).optional() });
const inline = z.array(textNode);

// Top-level blocks carry an id (sources and suggestions point at it); paragraphs nested in a quote or a
// list item may omit theirs.
const nestedParagraph = z.strictObject({ type: z.literal("paragraph"), attrs: z.strictObject({ id }).optional(), content: inline.optional() });
const listItem = z.strictObject({ type: z.literal("listItem"), attrs: z.strictObject({ id }).optional(), content: z.array(nestedParagraph).min(1) });

export const stillBlock = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), attrs: z.strictObject({ id }), content: inline.optional() }),
  // level 1 is a guide section title, added only when a guide is published (SPEC §11.8).
  z.strictObject({ type: z.literal("heading"), attrs: z.strictObject({ id, level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }), content: inline.optional() }),
  z.strictObject({ type: z.literal("blockquote"), attrs: z.strictObject({ id }), content: z.array(nestedParagraph).min(1) }),
  z.strictObject({ type: z.literal("bulletList"), attrs: z.strictObject({ id }), content: z.array(listItem).min(1) }),
  z.strictObject({ type: z.literal("orderedList"), attrs: z.strictObject({ id }), content: z.array(listItem).min(1) }),
  z.strictObject({
    type: z.literal("stillImage"),
    attrs: z.strictObject({ id, imageId: z.uuid(), display: z.enum(IMAGE_DISPLAYS), caption: z.string().nullable() }),
  }),
]);

// contents.doc (SPEC §10.8).
export const stillDoc = z.strictObject({ type: z.literal("doc"), content: z.array(stillBlock) });
// exhibitions.description / exhibitions.guide (SPEC §11.8) add a version.
export const stillDocument = z.strictObject({ version: z.literal(1), type: z.literal("doc"), content: z.array(stillBlock) });

export type StillBlock = z.infer<typeof stillBlock>;
export type StillDoc = z.infer<typeof stillDoc>;
export type StillDocument = z.infer<typeof stillDocument>;
export type TextNode = z.infer<typeof textNode>;

// contents.sources (SPEC §10.8): top-level node id → where its text sits in the source. `refs` are
// "{documentId}:{segmentId}" (shared/src/manifest.ts SOURCE_REF); start/end index the refs' texts
// joined with single spaces. Pasted or newly written blocks have no entry.
export const contentSources = z.record(
  id,
  z.strictObject({ refs: z.array(z.string()).min(1), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }),
);
// contents.fields (SPEC §10.8): artwork fields with their source refs.
export const contentFields = z.record(z.string().min(1).max(64), z.strictObject({ value: z.string(), refs: z.array(z.string()) }));
export type ContentSources = z.infer<typeof contentSources>;
export type ContentFields = z.infer<typeof contentFields>;

// The inline text nodes of a block, in order (a quote's or a list's paragraphs one after another).
export function inlineNodes(block: StillBlock): TextNode[] {
  if (block.type === "stillImage") return [];
  if (block.type === "paragraph" || block.type === "heading") return block.content ?? [];
  if (block.type === "blockquote") return block.content.flatMap((p) => p.content ?? []);
  return block.content.flatMap((item) => item.content.flatMap((p) => p.content ?? []));
}

// Plain text of a block; paragraphs of a quote or list are joined with "\n".
export function blockText(block: StillBlock): string {
  if (block.type === "stillImage") return block.attrs.caption ?? "";
  if (block.type === "paragraph" || block.type === "heading") return (block.content ?? []).map((t) => t.text).join("");
  const paragraphs = block.type === "blockquote" ? block.content : block.content.flatMap((item) => item.content);
  return paragraphs.map((p) => (p.content ?? []).map((t) => t.text).join("")).join("\n");
}

// Every node in the document, for the node limit.
export function countNodes(doc: { content: StillBlock[] }): number {
  let n = 1;
  for (const block of doc.content) {
    n += 1;
    if (block.type === "blockquote") n += block.content.reduce((sum, p) => sum + 1 + (p.content?.length ?? 0), 0);
    else if (block.type === "bulletList" || block.type === "orderedList")
      n += block.content.reduce((sum, item) => sum + 1 + item.content.reduce((s, p) => s + 1 + (p.content?.length ?? 0), 0), 0);
    else if (block.type !== "stillImage") n += block.content?.length ?? 0;
  }
  return n;
}

// The inline content of each paragraph (or heading) of a block, one array per text block: a run never
// crosses from one list item or quote paragraph into the next.
export function textblocks(block: StillBlock): TextNode[][] {
  if (block.type === "stillImage") return [];
  if (block.type === "paragraph" || block.type === "heading") return [block.content ?? []];
  if (block.type === "blockquote") return block.content.map((p) => p.content ?? []);
  return block.content.flatMap((item) => item.content.map((p) => p.content ?? []));
}

// Visitor sentences (SPEC §9.4 Scrap 문장): each run of consecutive scrap-marked text nodes inside one
// paragraph is one sentence. `blockId` is the top-level block that holds it.
export function scrapRuns(doc: { content: StillBlock[] }): { blockId: string; text: string; sentenceId: string | null }[] {
  const runs: { blockId: string; text: string; sentenceId: string | null }[] = [];
  for (const block of doc.content) {
    for (const inline of textblocks(block)) {
      let current: { blockId: string; text: string; sentenceId: string | null } | null = null;
      for (const node of inline) {
        const mark = node.marks?.find((m) => m.type === "scrap");
        if (!mark) { current = null; continue; }
        if (current && current.sentenceId === mark.attrs.sentenceId) current.text += node.text;
        else runs.push((current = { blockId: block.attrs.id, text: node.text, sentenceId: mark.attrs.sentenceId }));
      }
    }
  }
  return runs;
}

// What the Tiptap editor sends, brought to the STILL schema before validation (SPEC §9.4: only STILL
// nodes and attributes are stored): orderedList's default `start` and `type` attributes go, a hard line
// break becomes a space, and empty text nodes go. Anything else outside the schema is still refused.
export function normalizeEditorDoc(value: unknown): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk).filter((child) => child !== undefined);
    if (!node || typeof node !== "object") return node;
    const n = node as Record<string, unknown>;
    if (n.type === "hardBreak") return { type: "text", text: " " };
    if (n.type === "text" && n.text === "") return undefined;
    const out = Object.fromEntries(Object.entries(n).map(([key, child]) => [key, walk(child)]));
    if (n.type === "orderedList" && out.attrs && typeof out.attrs === "object") {
      out.attrs = Object.fromEntries(Object.entries(out.attrs).filter(([key]) => key !== "start" && key !== "type"));
    }
    return out;
  };
  return walk(value);
}
export const editorDoc = z.preprocess(normalizeEditorDoc, stillDoc);

export const EMPTY_DOC: StillDoc = { type: "doc", content: [] };
