import { createHash } from "node:crypto";
import type { ContentBlock, ContentKind, ContentStatus } from "../../../../shared/src/console-content";
import type { ExhibitionDraft } from "../../../../shared/src/console-draft";
import { inlineNodes, scrapRuns, stillDocument, type StillBlock, type StillDoc, type StillDocument, type TextNode } from "../../../../shared/src/still-doc";

// Compiles an exhibition draft into the visitor documents (SPEC §9.4 가이드 편집과 컴파일).
// Pure: no database, no clock. The preview (console.preview.get) and the publication worker share it.

export type CompileContent = {
  id: string;
  kind: ContentKind;
  status: ContentStatus;
  blocks: ContentBlock[];
  // Tiptap body (SPEC §10.8). Used when it has blocks; otherwise the legacy `blocks` are.
  doc: StillDoc;
  fields: Record<string, unknown> | null;
};
// Only what compile needs of an image row: ids of images that belong to the exhibition.
export type CompileImage = { id: string };

export type CompiledSentence = {
  contentId: string;
  blockId: string;
  text: string;
  // The id stored on the content block, or null while publication has not assigned one.
  guideSentenceId: string | null;
  // Set when the sentence is a scrap run of `contents.doc`: the run's position in scrapRuns(doc).
  docRun?: number;
};

export type Compiled = {
  // The INTRODUCTION sections' blocks; null when there are none.
  description: StillDocument | null;
  // Every other visible section; null when there are none.
  guide: StillDocument | null;
  // The `sentence` blocks that appear in `guide`, in order, once per (content, block).
  sentences: CompiledSentence[];
  // Images used by `description` and `guide` (not the cover, which lives in the draft).
  imageIds: string[];
  // What the draft has that visitors will not get, one line each, for the preview (SPEC §9.4).
  losses: string[];
  // storedDocument issues of `description` / `guide`. Publication must refuse while this is not empty.
  invalid: string[];
};

// A guide `sentence` block needs a sentence id before publication has created the guide_sentences
// row. Until then the id is derived from the content and block ids, so a preview shows the same
// id every time. Publication replaces it with the real `guideSentenceId`.
export function placeholderSentenceId(contentId: string, blockId: string): string {
  const hex = createHash("sha256").update(`${contentId}:${blockId}`).digest("hex");
  // Lay the hash out as a version-4 UUID so it passes z.uuid().
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function sentenceIdOf(sentence: CompiledSentence): string {
  return sentence.guideSentenceId ?? placeholderSentenceId(sentence.contentId, sentence.blockId);
}

// A legacy `blocks`-only content as a STILL doc; a legacy sentence keeps its block id and stored sentence id.
function legacyDoc(blocks: ContentBlock[]): StillDoc {
  const text = (t: string) => (t ? [{ type: "text" as const, text: t }] : undefined);
  return {
    type: "doc",
    content: blocks.map((b): StillBlock =>
      b.type === "image" ? { type: "stillImage", attrs: { id: b.id, imageId: b.imageId, display: "INLINE", caption: null } }
      : b.type === "heading" ? { type: "heading", attrs: { id: b.id, level: 2 }, content: text(b.text) }
      : b.type === "sentence" ? { type: "paragraph", attrs: { id: b.id }, content: [{ type: "text", text: b.text || " ", marks: [{ type: "scrap", attrs: { sentenceId: b.guideSentenceId ?? null } }] }] }
      : { type: "paragraph", attrs: { id: b.id }, content: text(b.text) }),
  };
}

// A block with its scrap marks removed (the introduction has no sentences) or its node ids made unique.
function mapNodes(block: StillBlock, change: (node: TextNode) => TextNode, id: string): StillBlock {
  const copy = structuredClone(block);
  copy.attrs = { ...copy.attrs, id } as typeof copy.attrs;
  const paragraphs = copy.type === "stillImage" || copy.type === "playlist" ? [] : copy.type === "paragraph" || copy.type === "heading" ? [copy] : copy.type === "blockquote" ? copy.content : copy.content.flatMap((i) => i.content);
  for (const p of paragraphs) if (p.content) p.content = p.content.map(change);
  return copy;
}
const withoutScrap = (node: TextNode): TextNode => ({ type: "text", text: node.text });

// A copy of `doc` where scrap run number k (as numbered by scrapRuns) carries ids.get(k).
export function withScrapIds(doc: StillDoc, ids: Map<number, string>): StillDoc {
  const copy = structuredClone(doc);
  let run = -1;
  for (const block of copy.content) {
    let current: { sentenceId: string | null } | null = null;
    for (const node of inlineNodes(block)) {
      const mark = node.marks?.find((m) => m.type === "scrap");
      if (!mark) { current = null; continue; }
      if (!current || current.sentenceId !== mark.attrs.sentenceId) { run += 1; current = { sentenceId: mark.attrs.sentenceId }; }
      const id = ids.get(run);
      if (id) mark.attrs.sentenceId = id;
    }
  }
  return copy;
}

// Only blocks of APPROVED contents are ever turned into document blocks (SPEC §9.1-6); the one
// other text is the section title, which the institution writes in the draft.
export function compileDraft(draft: ExhibitionDraft, contents: CompileContent[], images: CompileImage[]): Compiled {
  const contentById = new Map(contents.map((c) => [c.id, c]));
  const imageIds = new Set(images.map((i) => i.id));
  const losses = new Set<string>();
  const sentences: CompiledSentence[] = [];
  const usedImages = new Set<string>();
  const descriptionBlocks: StillBlock[] = [];
  const guideBlocks: StillBlock[] = [];

  for (const section of draft.sections) {
    const isIntroduction = section.kind === "INTRODUCTION";
    if (!section.visible) {
      losses.add(`Hidden section "${section.title}" is left out`);
      continue;
    }
    if (!isIntroduction) {
      const id = `sec-${section.id}`.slice(0, 64);
      guideBlocks.push({ type: "heading", attrs: { id, level: 1 }, content: section.title ? [{ type: "text", text: section.title }] : undefined });
    }

    for (const contentId of section.contentIds) {
      const content = contentById.get(contentId);
      if (content?.status !== "APPROVED") {
        losses.add(`A ${content ? "content that is not approved" : "missing content"} in section "${section.title}" is left out`);
        continue;
      }
      if (!isIntroduction && content.kind === "THEME") losses.add("Theme cards are shown as plain text");
      if (!isIntroduction && content.kind === "ARTWORK") losses.add("Artwork title and year are not shown as a caption");

      const legacy = content.doc.content.length === 0;
      const doc = legacy ? legacyDoc(content.blocks) : content.doc;
      const runs = scrapRuns(doc).map((run, docRun) => ({ ...run, docRun }));
      const found = runs.map((r) => ({ contentId, blockId: legacy ? r.blockId : `${r.blockId}#${r.docRun}`, text: r.text, guideSentenceId: r.sentenceId, docRun: legacy ? undefined : r.docRun }));
      // Until publication assigns ids the marks carry the placeholder ids, so a preview is stable.
      const marked = withScrapIds(doc, new Map(found.map((s, k) => [k, sentenceIdOf(s)])));
      if (!isIntroduction) {
        for (const s of found) if (!sentences.some((o) => o.contentId === contentId && o.blockId === s.blockId)) sentences.push(s);
      }

      const prefix = contentId.slice(0, 8);
      for (const block of marked.content) {
        if (block.type === "stillImage" && !imageIds.has(block.attrs.imageId)) {
          losses.add(`An image in section "${section.title}" is not part of this exhibition and is left out`);
          continue;
        }
        if (block.type === "stillImage") usedImages.add(block.attrs.imageId);
        const id = `${prefix}-${block.attrs.id}`.slice(0, 64);
        if (isIntroduction && runs.length) losses.add("Sentences in the introduction become paragraphs");
        (isIntroduction ? descriptionBlocks : guideBlocks).push(mapNodes(block, isIntroduction ? withoutScrap : (n) => n, id));
      }
    }
  }

  const toDocument = (content: StillBlock[]) => (content.length ? { version: 1 as const, type: "doc" as const, content } : null);
  const description = toDocument(descriptionBlocks);
  const guide = toDocument(guideBlocks);
  const invalid = [description && ["description", description], guide && ["guide", guide]]
    .filter((entry) => entry !== null)
    .flatMap(([name, doc]) => {
      const result = stillDocument.safeParse(doc);
      return result.success ? [] : result.error.issues.map((issue) => `${name}: ${issue.path.join(".")} ${issue.message}`);
    });

  return { description, guide, sentences, imageIds: [...usedImages], losses: [...losses], invalid };
}
