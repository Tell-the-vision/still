import type { ExpandedBlock, ExpandedDocument, StoredDocument } from "../../../shared/src/document";
import { publicImageUrl } from "../media/public-url";

type ImageRow = { id: string; objectKey: string; altText: string | null; width: number; height: number };

// Resolves stored references into the served form (SPEC §11.8).
// Blocks whose reference is missing are dropped. Sentence expansion arrives with guide.get.
export function expandDocument(
  doc: StoredDocument | null,
  { images }: { images: ImageRow[] },
): ExpandedDocument | null {
  if (!doc) return null;
  const blocks: ExpandedBlock[] = [];
  for (const block of doc.blocks) {
    if (block.type === "image") {
      const image = images.find((i) => i.id === block.imageId);
      if (!image) continue;
      const { altText, width, height } = image;
      blocks.push({ type: "image", imageId: image.id, url: publicImageUrl(image.objectKey), altText, width, height });
    } else if (block.type !== "sentence") {
      blocks.push(block);
    }
  }
  return { version: 1, blocks };
}
