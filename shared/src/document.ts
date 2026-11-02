import { z } from "zod";

// Stored form of a description or guide document (SPEC §9).
// Strict objects: unknown blocks or fields are rejected, not stripped.
export const storedDocument = z.strictObject({
  version: z.literal(1),
  blocks: z.array(
    z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("heading"), text: z.string() }),
      z.strictObject({ type: z.literal("paragraph"), text: z.string() }),
      z.strictObject({ type: z.literal("image"), imageId: z.uuid() }),
      z.strictObject({ type: z.literal("sentence"), sentenceId: z.uuid() }),
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
