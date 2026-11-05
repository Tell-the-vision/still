import type { images } from "../../db/schema";
import { publicImageUrl } from "../../media/public-url";
import { documentPrefix } from "./manifests";

// The files behind an image of the console (SPEC §10.7). An image extracted from a document has its display file
// in the private bucket from extraction on, and a public copy as well once it is published (SPEC §10.9 step 2);
// any other image (imported with its exhibition) has its public file only.

type ImageFiles = Pick<typeof images.$inferSelect, "id" | "exhibitionId" | "objectKey" | "documentId" | "manifestAssetId">;

// The private key of an image's display file (its manifest `display`), or null for an image that did not come from
// a document. validateManifest accepts no other name for an asset's display file, so the key follows from the row.
export function displayKeyOf(institutionId: string, image: ImageFiles): string | null {
  if (image.documentId === null || image.manifestAssetId === null) return null;
  return `${documentPrefix(institutionId, image.exhibitionId, image.documentId)}assets/${image.manifestAssetId}.display.webp`;
}

// Where the console shows an image: one extracted from a document through GET /api/console/images/{id} (its display
// file, the same before and after publication), any other at its public URL; null when there is no file to show.
export function consoleImageUrl(image: ImageFiles): string | null {
  if (image.documentId !== null) return `/api/console/images/${image.id}`;
  return image.objectKey === null ? null : publicImageUrl(image.objectKey);
}
