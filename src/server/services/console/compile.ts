import { createHash } from "node:crypto";
import type { ContentBlock, ContentKind, ContentStatus } from "../../../../shared/src/console-content";
import type { ExhibitionDraft } from "../../../../shared/src/console-draft";
import { storedDocument, type StoredDocument } from "../../../../shared/src/document";
import { blockText, inlineNodes, scrapRuns, type StillBlock, type StillDoc, type TextNode } from "../../../../shared/src/still-doc";

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
  description: StoredDocument | null;
  // Every other visible section; null when there are none.
  guide: StoredDocument | null;
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

type StoredBlock = StoredDocument["blocks"][number];

// What one content contributes, before the introduction / guide difference is applied.
type Piece = StoredBlock | { type: "sentence-run"; blockId: string; text: string; guideSentenceId: string | null; docRun?: number };

// The text of each paragraph of a block without its scrap runs (those become sentences).
function plainParagraphs(block: StillBlock): string[] {
  if (block.type === "stillImage") return [];
  const paragraphs: TextNode[][] =
    block.type === "paragraph" || block.type === "heading" ? [block.content ?? []]
    : block.type === "blockquote" ? block.content.map((p) => p.content ?? [])
    : block.content.flatMap((item) => item.content.map((p) => p.content ?? []));
  return paragraphs.map((nodes) => nodes.filter((n) => !n.marks?.length).map((n) => n.text).join("")).filter((t) => t !== "");
}

// A doc-based content as pieces: each block's plain text first, then its scrap runs, in order.
function docPieces(doc: StillDoc): Piece[] {
  const runs = scrapRuns(doc).map((run, docRun) => ({ ...run, docRun }));
  return doc.content.flatMap((block): Piece[] => {
    if (block.type === "stillImage") return [{ type: "image", imageId: block.attrs.imageId }];
    const own = runs.filter((r) => r.blockId === block.attrs.id);
    const text: Piece[] = block.type === "heading" ? [{ type: "heading", text: blockText(block) }] : plainParagraphs(block).map((t) => ({ type: "paragraph", text: t }));
    return [...text, ...own.map((r): Piece => ({ type: "sentence-run", blockId: `${r.blockId}#${r.docRun}`, text: r.text, guideSentenceId: r.sentenceId, docRun: r.docRun }))];
  });
}

function legacyPieces(blocks: ContentBlock[]): Piece[] {
  return blocks.map((b): Piece =>
    b.type === "image" ? { type: "image", imageId: b.imageId }
    : b.type === "sentence" ? { type: "sentence-run", blockId: b.id, text: b.text, guideSentenceId: b.guideSentenceId ?? null }
    : { type: b.type, text: b.text });
}

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
  const descriptionBlocks: StoredBlock[] = [];
  const guideBlocks: StoredBlock[] = [];

  for (const section of draft.sections) {
    const isIntroduction = section.kind === "INTRODUCTION";
    const blocks = isIntroduction ? descriptionBlocks : guideBlocks;
    if (!section.visible) {
      losses.add(`Hidden section "${section.title}" is left out`);
      continue;
    }
    if (!isIntroduction) blocks.push({ type: "heading", text: section.title });

    for (const contentId of section.contentIds) {
      const content = contentById.get(contentId);
      if (content?.status !== "APPROVED") {
        losses.add(`A ${content ? "content that is not approved" : "missing content"} in section "${section.title}" is left out`);
        continue;
      }
      if (!isIntroduction && content.kind === "THEME") losses.add("Theme cards are shown as plain text");
      if (!isIntroduction && content.kind === "ARTWORK") losses.add("Artwork title and year are not shown as a caption");

      const pieces = content.doc.content.length > 0 ? docPieces(content.doc) : legacyPieces(content.blocks);
      for (const piece of pieces) {
        if (piece.type === "image") {
          if (!imageIds.has(piece.imageId)) {
            losses.add(`An image in section "${section.title}" is not part of this exhibition and is left out`);
            continue;
          }
          usedImages.add(piece.imageId);
          blocks.push({ type: "image", imageId: piece.imageId });
        } else if (piece.type === "sentence-run" && isIntroduction) {
          losses.add("Sentences in the introduction become paragraphs");
          blocks.push({ type: "paragraph", text: piece.text });
        } else if (piece.type === "sentence-run") {
          const sentence = { contentId, blockId: piece.blockId, text: piece.text, guideSentenceId: piece.guideSentenceId, docRun: piece.docRun };
          blocks.push({ type: "sentence", sentenceId: sentenceIdOf(sentence) });
          if (!sentences.some((s) => s.contentId === contentId && s.blockId === piece.blockId)) sentences.push(sentence);
        } else {
          blocks.push(piece);
        }
      }
    }
  }

  const description = descriptionBlocks.length ? { version: 1 as const, blocks: descriptionBlocks } : null;
  const guide = guideBlocks.length ? { version: 1 as const, blocks: guideBlocks } : null;
  const invalid = [description && ["description", description], guide && ["guide", guide]]
    .filter((entry) => entry !== null)
    .flatMap(([name, doc]) => {
      const result = storedDocument.safeParse(doc);
      return result.success ? [] : result.error.issues.map((issue) => `${name}: ${issue.path.join(".")} ${issue.message}`);
    });

  return { description, guide, sentences, imageIds: [...usedImages], losses: [...losses], invalid };
}
