import { contentBlocks, type ContentBlock } from "@still/shared/console-content";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { contents, images } from "../../db/schema";

// One image an item references, as the console shows it. The object key is not part of it: an image
// without a public copy has no URL the console may hand out (SPEC §9.4 이미지).
export type ConsoleContentImage = {
  id: string;
  altText: string | null;
  credit: string | null;
  rights: string;
  verification: string;
  width: number;
  height: number;
};

// One content item as the review screen lists it (SPEC §9.4 검토, §10.8, Figma A2).
export type ConsoleContentRow = {
  id: string;
  kind: string;
  status: string;
  blocks: ContentBlock[];
  fields: unknown;
  suggestions: unknown;
  editorialNote: string | null;
  revision: string;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  images: ConsoleContentImage[];
};

// The contents of `exhibitionId` matching `where`, oldest first (ties by id). Image rows are read
// within the same exhibition, so a block cannot pull in another institution's image.
export async function contentRows(exhibitionId: string, { where }: { where?: SQL } = {}): Promise<ConsoleContentRow[]> {
  const rows = await db
    .select()
    .from(contents)
    .where(and(eq(contents.exhibitionId, exhibitionId), where))
    .orderBy(asc(contents.createdAt), asc(contents.id));
  const blocksOf = rows.map((row) => contentBlocks.parse(row.blocks));
  const imageIds = [...new Set(blocksOf.flat().flatMap((block) => (block.type === "image" ? [block.imageId] : [])))];
  const imageRows = imageIds.length
    ? await db
        .select({ id: images.id, altText: images.altText, credit: images.credit, rights: images.rights, verification: images.verification, width: images.width, height: images.height })
        .from(images)
        .where(and(eq(images.exhibitionId, exhibitionId), inArray(images.id, imageIds)))
    : [];
  const imageById = new Map(imageRows.map((image) => [image.id, image]));
  return rows.map((row, i) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    blocks: blocksOf[i],
    fields: row.fields,
    suggestions: row.suggestions,
    editorialNote: row.editorialNote,
    revision: row.revision,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    images: blocksOf[i].flatMap((block) => {
      const image = block.type === "image" ? imageById.get(block.imageId) : undefined;
      return image ? [image] : [];
    }),
  }));
}
