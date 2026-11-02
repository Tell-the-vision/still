import { z } from "zod";

// Stored form of a description or guide document (SPEC §9).
export const storedDocument = z.object({
  version: z.literal(1),
  blocks: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("heading"), text: z.string() }),
      z.object({ type: z.literal("paragraph"), text: z.string() }),
      z.object({ type: z.literal("image"), imageId: z.uuid() }),
      z.object({ type: z.literal("sentence"), sentenceId: z.uuid() }),
    ]),
  ),
});
export type StoredDocument = z.infer<typeof storedDocument>;

// Served form: image and sentence references are resolved.
export type ExpandedBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; imageId: string; url: string; altText: string | null; width: number; height: number }
  | { type: "sentence"; sentenceId: string; text: string };

export type ExpandedDocument = { version: 1; blocks: ExpandedBlock[] };
