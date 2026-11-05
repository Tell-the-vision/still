import { z } from "zod";
import type { StillBlock } from "./still-doc";

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

// Served form (SPEC §11.8): a STILL document whose stillImage attrs also carry the public url and size.
export type ExpandedBlock =
  | Exclude<StillBlock, { type: "stillImage" }>
  | (Omit<Extract<StillBlock, { type: "stillImage" }>, "attrs"> & {
      attrs: Extract<StillBlock, { type: "stillImage" }>["attrs"] & { url: string; altText: string | null; width: number; height: number };
    });

export type ExpandedDocument = { version: 1; type: "doc"; content: ExpandedBlock[] };
