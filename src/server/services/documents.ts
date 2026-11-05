import type { ExpandedBlock, ExpandedDocument, StoredDocument } from "../../../shared/src/document";
import { publicImageUrl } from "../media/public-url";

type SentenceRow = { id: string; content: string };
type ImageRow = { id: string; objectKey: string | null; altText: string | null; width: number; height: number };

// Resolves stored references into the served form (SPEC §11.8).
// Blocks whose reference is missing, or whose image has no public copy yet, are dropped.
export function expandDocument(
  doc: StoredDocument | null,
  { images, sentences = [] }: { images: ImageRow[]; sentences?: SentenceRow[] },
): ExpandedDocument | null {
  if (!doc) return null;
  const blocks: ExpandedBlock[] = [];
  for (const block of doc.blocks) {
    if (block.type === "image") {
      const image = images.find((i) => i.id === block.imageId);
      if (!image || image.objectKey === null) continue;
      const { altText, width, height } = image;
      blocks.push({ type: "image", imageId: image.id, url: publicImageUrl(image.objectKey), altText, width, height });
    } else if (block.type === "sentence") {
      const sentence = sentences.find((s) => s.id === block.sentenceId);
      if (sentence) blocks.push({ type: "sentence", sentenceId: sentence.id, text: sentence.content });
    } else {
      blocks.push(block);
    }
  }
  return { version: 1, blocks };
}
