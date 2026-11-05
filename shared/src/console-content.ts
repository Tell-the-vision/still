import { z } from "zod";

export const CONTENT_KINDS = [
  "INTRODUCTION",
  "ARTIST",
  "CURATOR_STATEMENT",
  "THEME",
  "ARTWORK",
  "GALLERY_SECTION",
  "AUDIO_NARRATION",
  "PRESS_EXCERPT",
  "CLOSING",
  "OTHER",
] as const;
export const CONTENT_STATUSES = ["READY", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export const IMAGE_DISPLAYS = ["HERO", "GALLERY", "INLINE", "PORTRAIT"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

const textBlock = {
  id: z.string().min(1),
  text: z.string(),
  origin: z.enum(["SOURCE", "EDITED"]),
  refs: z.array(z.string()),
};

// Shape of contents.blocks (SPEC §10.8). Reference and origin rules are checked on write, not here.
export const contentBlock = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("heading"), ...textBlock }),
  z.strictObject({ type: z.literal("paragraph"), ...textBlock }),
  z.strictObject({ type: z.literal("sentence"), ...textBlock, guideSentenceId: z.uuid().optional() }),
  z.strictObject({
    type: z.literal("image"),
    id: z.string().min(1),
    imageId: z.uuid(),
    display: z.enum(IMAGE_DISPLAYS),
    captionRefs: z.array(z.string()),
  }),
]);
export const contentBlocks = z.array(contentBlock);

export type ContentBlock = z.infer<typeof contentBlock>;
