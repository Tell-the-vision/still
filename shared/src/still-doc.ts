import { z } from "zod";

// The STILL schema (SPEC §9.4 편집기, §10.8, §11.8): one Tiptap document format for item bodies in the
// console, the published guide and the description. Plain text only; the one mark is `scrap` (a
// sentence visitors can keep). Visitors render it with the STILL renderer, never with Tiptap.

export const IMAGE_DISPLAYS = ["HERO", "GALLERY", "INLINE", "PORTRAIT"] as const;
export const MAX_NODES = 500; // SPEC §10.8 implementation default

const id = z.string().min(1).max(64);

// A playlist link must be the provider's own: Spotify or Apple Music (the exhibition_playlists rule).
export const PLAYLIST_URL = /^https:\/\/(open\.spotify\.com|music\.apple\.com)\/\S+$/;
export const playlistProvider = (url: string) => (url.startsWith("https://open.spotify.com/") ? "SPOTIFY" : "APPLE_MUSIC");

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
  // A playlist to listen to with the page; visitors see a row that opens it. The title may be empty.
  z.strictObject({ type: z.literal("playlist"), attrs: z.strictObject({ id, url: z.string().max(2000).regex(PLAYLIST_URL), title: z.string().max(200) }) }),
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
  if (block.type === "stillImage" || block.type === "playlist") return [];
  if (block.type === "paragraph" || block.type === "heading") return block.content ?? [];
  if (block.type === "blockquote") return block.content.flatMap((p) => p.content ?? []);
  return block.content.flatMap((item) => item.content.flatMap((p) => p.content ?? []));
}

// Plain text of a block; paragraphs of a quote or list are joined with "\n".
export function blockText(block: StillBlock): string {
  if (block.type === "stillImage") return block.attrs.caption ?? "";
  if (block.type === "playlist") return block.attrs.title;
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
    else if (block.type !== "stillImage" && block.type !== "playlist") n += block.content?.length ?? 0;
  }
  return n;
}

// Visitor sentences (SPEC §9.4 Scrap 문장): each run of consecutive scrap-marked text nodes inside one
// block is one sentence. `blockId` is the top-level block that holds it.
export function scrapRuns(doc: { content: StillBlock[] }): { blockId: string; text: string; sentenceId: string | null }[] {
  const runs: { blockId: string; text: string; sentenceId: string | null }[] = [];
  for (const block of doc.content) {
    let current: { blockId: string; text: string; sentenceId: string | null } | null = null;
    for (const node of inlineNodes(block)) {
      const mark = node.marks?.find((m) => m.type === "scrap");
      if (!mark) { current = null; continue; }
      if (current && current.sentenceId === mark.attrs.sentenceId) current.text += node.text;
      else runs.push((current = { blockId: block.attrs.id, text: node.text, sentenceId: mark.attrs.sentenceId }));
    }
  }
  return runs;
}

export const EMPTY_DOC: StillDoc = { type: "doc", content: [] };
