import { z } from "zod";
import { CONTENT_KINDS } from "./console-content";
import { SECTION_KINDS } from "./console-draft";
import { IMAGE_DISPLAYS } from "./still-doc";

// SPEC §9.4 구조화 (2026-11-05 update): the Worker sends Gemini one chunk of one document as plain text
// per page in reading order, and Gemini answers with a reduced editor schema whose text is copied from
// the source. The server aligns every text with the manifest letter by letter (whitespace may differ)
// and records the source ranges in contents.sources (SPEC §10.8 쓰기 경로). Node ids and the Tiptap
// nesting are added by the server. Signing: shared/src/analysis-worker-signature.ts (same headers).

export const structureInput = z.strictObject({
  analysisId: z.uuid(),
  chunk: z.number().int().nonnegative(),
  document: z.strictObject({ mediaType: z.string(), category: z.string().nullable() }),
  pages: z.array(z.strictObject({ page: z.number().int().positive(), text: z.string() })),
  // Manifest asset ids of this document, with a presigned model-input URL when one exists.
  images: z.array(z.strictObject({ id: z.string().regex(/^a\d{2,}$/), page: z.number().int().positive().nullable(), url: z.url().nullable() })),
});

const outputBlock = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().min(1) }),
  z.strictObject({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.strictObject({ type: z.literal("quote"), text: z.string().min(1) }),
  z.strictObject({ type: z.literal("bulletList"), items: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ type: z.literal("orderedList"), items: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ type: z.literal("stillImage"), imageId: z.string().regex(/^a\d{2,}$/), display: z.enum(IMAGE_DISPLAYS), caption: z.string().nullable() }),
]);

export const structureOutput = z.strictObject({
  items: z.array(
    z.strictObject({
      kind: z.enum(CONTENT_KINDS),
      label: z.string().nullable(), // a section or theme name the source lacks: LABEL_GENERATED
      blocks: z.array(outputBlock),
      fields: z.record(z.string().min(1).max(64), z.string()),
      suggestions: z.array(z.strictObject({ kind: z.string(), target: z.record(z.string(), z.unknown()) })),
    }),
  ),
  outline: z.array(z.strictObject({ section: z.enum(SECTION_KINDS), title: z.string().nullable(), items: z.array(z.number().int().nonnegative()) })),
  variants: z.array(z.strictObject({ use: z.string(), instead: z.string() })),
  usage: z.strictObject({ model: z.string(), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }),
});

export type StructureInput = z.infer<typeof structureInput>;
export type StructureOutput = z.infer<typeof structureOutput>;
export type StructureOutputBlock = z.infer<typeof outputBlock>;
