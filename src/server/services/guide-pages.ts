import { eq } from "drizzle-orm";
import { guidePages } from "../../../shared/src/guide-pages";
import { blockText, inlineNodes, stillDocument } from "../../../shared/src/still-doc";
import { db } from "../db/client";
import { images } from "../db/schema";
import { publicImageUrl } from "../media/public-url";
import { hasPublicCopy } from "./visible";

// One page of a published guide (each artwork has its own address, /e/{code}/{page}; see guidePages). What a keepsake
// of the page needs: its title, its first picture and the sentences on it.
export async function guidePage(guide: unknown, page: string) {
  const blocks = guidePages(stillDocument.safeParse(guide).data?.content ?? []).find((p) => p.page === page)?.blocks ?? [];
  const heading = blocks.find((block) => block.type === "heading");
  const picture = blocks.find((block) => block.type === "stillImage");
  const image = picture?.type === "stillImage" ? await db.query.images.findFirst({ where: eq(images.id, picture.attrs.imageId) }) : undefined;
  return {
    found: blocks.length > 0,
    title: heading ? blockText(heading) : "",
    image: hasPublicCopy(image) ? { url: publicImageUrl(image.objectKey), altText: image.altText, width: image.width, height: image.height } : null,
    sentenceIds: new Set(blocks.flatMap((block) => inlineNodes(block)).flatMap((text) => text.marks?.[0]?.attrs.sentenceId ?? [])),
  };
}
