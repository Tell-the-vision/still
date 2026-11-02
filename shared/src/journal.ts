import { z } from "zod";
import { codeSchema } from "./code";

// Interim 미결정 9: not blank, at most 2000 NFC code points. The only place the rule lives.
export const journalContent = z
  .string()
  .refine((s) => s.trim().length > 0)
  .refine((s) => [...s.normalize("NFC")].length <= 2000);

export const journalUpsertInput = z.object({
  code: codeSchema,
  content: z.string(),
  audioType: z.enum(["EXTERNAL", "AMBIENCE", "NONE"]).nullable(),
  revision: z.uuid().nullable(),
});
