import { createHash } from "node:crypto";
import type { ContentBlock, ContentKind, ContentStatus } from "../../../../shared/src/console-content";
import type { ExhibitionDraft } from "../../../../shared/src/console-draft";
import { storedDocument, type StoredDocument } from "../../../../shared/src/document";

// Compiles an exhibition draft into the visitor documents (SPEC §9.4 가이드 편집과 컴파일).
// Pure: no database, no clock. The preview (console.preview.get) and the publication worker share it.

export type CompileContent = {
  id: string;
  kind: ContentKind;
  status: ContentStatus;
  blocks: ContentBlock[];
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

      for (const block of content.blocks) {
        if (block.type === "image") {
          if (!imageIds.has(block.imageId)) {
            losses.add(`An image in section "${section.title}" is not part of this exhibition and is left out`);
            continue;
          }
          usedImages.add(block.imageId);
          blocks.push({ type: "image", imageId: block.imageId });
        } else if (block.type === "sentence" && isIntroduction) {
          losses.add("Sentences in the introduction become paragraphs");
          blocks.push({ type: "paragraph", text: block.text });
        } else if (block.type === "sentence") {
          const sentence = { contentId, blockId: block.id, text: block.text, guideSentenceId: block.guideSentenceId ?? null };
          blocks.push({ type: "sentence", sentenceId: sentenceIdOf(sentence) });
          if (!sentences.some((s) => s.contentId === contentId && s.blockId === block.id)) sentences.push(sentence);
        } else {
          blocks.push({ type: block.type, text: block.text });
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
