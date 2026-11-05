import { z } from "zod";

// SPEC §9.4 제안, §10.10 analysis.suggest: POST /suggest. The server sends each new item's text blocks; the
// Worker answers with editing suggestions in the proposal shapes of src/server/services/console/suggestion-apply.ts.
// `contentId` is null for an exhibition-wide suggestion. Signing: same headers as /structure.

export const SUGGEST_KINDS = [
  "TEXT_EXTRACTION_FIX",
  "PUNCTUATION_CONSISTENCY",
  "STRUCTURE_LEVEL",
  "MISSING_HEADING",
  "SPLIT_FOR_MOBILE",
  "GUIDE_SENTENCE_CANDIDATE",
] as const;

export const suggestInput = z.strictObject({
  analysisId: z.uuid(),
  items: z.array(
    z.strictObject({
      contentId: z.uuid(),
      kind: z.string(),
      blocks: z.array(z.strictObject({ id: z.string(), type: z.string(), text: z.string() })),
    }),
  ),
});

export const suggestOutput = z.strictObject({
  suggestions: z.array(
    z.strictObject({
      contentId: z.uuid().nullable(),
      kind: z.enum(SUGGEST_KINDS),
      target: z.strictObject({ node: z.string() }),
      proposal: z.record(z.string(), z.unknown()),
      rationale: z.string(),
    }),
  ),
  usage: z.strictObject({ model: z.string(), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }),
});

export type SuggestInput = z.infer<typeof suggestInput>;
export type SuggestOutput = z.infer<typeof suggestOutput>;
