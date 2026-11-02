import { z } from "zod";
import { codeSchema } from "./code";

export const KEEPSAKE_TEMPLATES = ["sentence", "reflection", "cover"] as const;

export const keepsakeUpsertInput = z.object({
  code: codeSchema,
  templateId: z.string(),
  sentenceIds: z.uuid().array().max(3).optional(),
  journalExcerpt: z.string().max(280).optional(),
});

// SPEC §7.1 defaults, shared so the server and the client preview agree.
export function templateDefaults(templateId: string, scraps: { sentenceId: string; content: string }[], journalContent: string | null) {
  const sentences = templateId === "cover" ? [] : scraps.slice(0, 1);
  const journalExcerpt = templateId === "reflection" && journalContent ? [...journalContent.normalize("NFC")].slice(0, 140).join("") : null;
  return { sentences, journalExcerpt };
}
