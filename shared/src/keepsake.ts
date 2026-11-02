import { z } from "zod";
import { codeSchema } from "./code";

export const KEEPSAKE_TEMPLATES = ["sentence", "reflection", "cover"] as const;

export const keepsakeUpsertInput = z.object({
  code: codeSchema,
  templateId: z.string(),
  sentenceIds: z.uuid().array().max(3).optional(),
});
