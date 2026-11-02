import { z } from "zod";

// Public URL of a stored image (SPEC §9). Images are served from MEDIA_BASE_URL.
export function publicImageUrl(objectKey: string) {
  return `${z.url().parse(process.env.MEDIA_BASE_URL)}/${objectKey}`;
}
