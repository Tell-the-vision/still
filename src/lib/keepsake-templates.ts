/**
 * Digital Keepsake templates (KEEPSAKE-02).
 *
 * A keepsake is a *snapshot*: when the user saves a card we freeze the
 * exhibition info + the chosen sentence / journal excerpt into `content`
 * so the card never changes afterwards, even if the journal is edited.
 *
 * Rendering lives in `components/KeepsakeCard.tsx`; this file is pure data
 * so both the API (validation) and the client (preview) can share it.
 */

export const KEEPSAKE_TEMPLATE_IDS = ["sentence", "reflection", "cover"] as const;
export type KeepsakeTemplateId = (typeof KEEPSAKE_TEMPLATE_IDS)[number];

export type KeepsakeTemplate = {
  id: KeepsakeTemplateId;
  name: string;
  description: string;
  /** Which optional fields the template displays. */
  uses: { sentence: boolean; journalExcerpt: boolean; coverImage: boolean };
};

export const KEEPSAKE_TEMPLATES: KeepsakeTemplate[] = [
  {
    id: "sentence",
    name: "Sentence",
    description: "저장한 문장 하나를 중심에 둔 카드",
    uses: { sentence: true, journalExcerpt: false, coverImage: false },
  },
  {
    id: "reflection",
    name: "Reflection",
    description: "Journal의 일부를 담은 카드",
    uses: { sentence: false, journalExcerpt: true, coverImage: false },
  },
  {
    id: "cover",
    name: "Cover",
    description: "전시 대표 이미지와 정보를 담은 카드",
    uses: { sentence: true, journalExcerpt: false, coverImage: true },
  },
];

export function getTemplate(id: string): KeepsakeTemplate | undefined {
  return KEEPSAKE_TEMPLATES.find((t) => t.id === id);
}

export function isTemplateId(id: unknown): id is KeepsakeTemplateId {
  return typeof id === "string" && (KEEPSAKE_TEMPLATE_IDS as readonly string[]).includes(id);
}

/** Frozen card content stored in digital_keepsakes.content_data (JSON). */
export type KeepsakeContent = {
  exhibitionTitle: string;
  exhibitionSubtitle?: string | null;
  venue?: string | null;
  /** e.g. "2026.10.10 – 2026.12.28" */
  periodLabel?: string | null;
  /** The day the user saved the card, "2026.11.02" */
  savedDateLabel: string;
  coverImageUrl?: string | null;
  sentence?: string | null;
  journalExcerpt?: string | null;
};

export const KEEPSAKE_LIMITS = {
  sentenceMax: 300,
  journalExcerptMax: 240,
} as const;

/** Card geometry: 3:4, rendered at 360×480 CSS px, exported at 3× (1080×1440). */
export const KEEPSAKE_CARD = { width: 360, height: 480, exportPixelRatio: 3 } as const;

export function parseKeepsakeContent(raw: string): KeepsakeContent {
  try {
    const j = JSON.parse(raw) as Partial<KeepsakeContent>;
    return {
      exhibitionTitle: String(j.exhibitionTitle ?? ""),
      exhibitionSubtitle: j.exhibitionSubtitle ?? null,
      venue: j.venue ?? null,
      periodLabel: j.periodLabel ?? null,
      savedDateLabel: String(j.savedDateLabel ?? ""),
      coverImageUrl: j.coverImageUrl ?? null,
      sentence: j.sentence ?? null,
      journalExcerpt: j.journalExcerpt ?? null,
    };
  } catch {
    return { exhibitionTitle: "", savedDateLabel: "" };
  }
}

/** Validate + normalise client-provided content. Returns an error message or null. */
export function validateKeepsakeContent(
  templateId: string,
  c: Partial<KeepsakeContent>,
): string | null {
  const t = getTemplate(templateId);
  if (!t) return "알 수 없는 템플릿입니다.";
  if (!c.exhibitionTitle) return "전시 정보가 비어 있습니다.";
  if (t.uses.sentence && c.sentence && c.sentence.length > KEEPSAKE_LIMITS.sentenceMax)
    return `문장은 ${KEEPSAKE_LIMITS.sentenceMax}자 이내여야 합니다.`;
  if (
    t.uses.journalExcerpt &&
    c.journalExcerpt &&
    c.journalExcerpt.length > KEEPSAKE_LIMITS.journalExcerptMax
  )
    return `Journal 발췌는 ${KEEPSAKE_LIMITS.journalExcerptMax}자 이내여야 합니다.`;
  return null;
}
