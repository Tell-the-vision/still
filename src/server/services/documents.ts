import type { ExpandedBlock, ExpandedDocument } from "../../../shared/src/document";
import type { StillDocument } from "../../../shared/src/still-doc";
import { publicImageUrl } from "../media/public-url";

type ImageRow = { id: string; objectKey: string | null; altText: string | null; width: number; height: number };

// Resolves stored image references into the served form (SPEC §11.8).
// Images without a public copy yet are dropped; scrap marks already carry their sentence ids.
export function expandDocument(doc: StillDocument | null, { images }: { images: ImageRow[] }): ExpandedDocument | null {
  if (!doc) return null;
  const content: ExpandedBlock[] = [];
  for (const block of doc.content) {
    if (block.type !== "stillImage") {
      content.push(block);
      continue;
    }
    const image = images.find((i) => i.id === block.attrs.imageId);
    if (!image || image.objectKey === null) continue;
    const { altText, width, height } = image;
    content.push({ ...block, attrs: { ...block.attrs, url: publicImageUrl(image.objectKey), altText, width, height } });
  }
  return { version: 1, type: "doc", content };
}
