import { z } from "zod";
import { codeSchema } from "./code";

export const KEEPSAKE_TEMPLATES = ["sentence", "reflection", "cover"] as const;

// Interim (미결정 3·4, #12): how many saved sentences each template puts on the card.
// The creator offers this many picks and the server keeps no more, so the card shows every saved pick.
const SENTENCE_LIMITS: Record<string, number> = { sentence: 3, reflection: 1, cover: 0 };
export const sentenceLimit = (templateId: string) => SENTENCE_LIMITS[templateId] ?? 0;

// The longest journal excerpt a card holds, in string length (what zod's max counts).
export const EXCERPT_MAX = 280;

// A journal paragraph cut to fit the card: its start, never splitting a character.
// Still a substring of the journal, so the server's excerpt check holds.
export function clipExcerpt(paragraph: string) {
  let clipped = "";
  for (const char of paragraph) {
    if (clipped.length + char.length > EXCERPT_MAX) break;
    clipped += char;
  }
  return clipped;
}

export const keepsakeUpsertInput = z.object({
  code: codeSchema,
  templateId: z.string(),
  sentenceIds: z.uuid().array().max(3).optional(),
  journalExcerpt: z.string().max(EXCERPT_MAX).optional(),
});

// SPEC §7.1 defaults, shared so the server and the client preview agree.
export function templateDefaults(templateId: string, scraps: { sentenceId: string; content: string }[], journalContent: string | null) {
  const sentences = templateId === "cover" ? [] : scraps.slice(0, 1);
  const journalExcerpt = templateId === "reflection" && journalContent ? [...journalContent.normalize("NFC")].slice(0, 140).join("") : null;
  return { sentences, journalExcerpt };
}
