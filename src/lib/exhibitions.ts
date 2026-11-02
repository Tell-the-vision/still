import { asc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  audioConfigurations,
  exhibitions,
  guideSentences,
  type AudioConfiguration,
  type Exhibition,
  type GuideSentence,
} from "@/db/schema";

/** Resolve an exhibition by id *or* slug. */
export async function findExhibition(idOrSlug: string): Promise<Exhibition | null> {
  const row = await db.query.exhibitions.findFirst({
    where: or(eq(exhibitions.id, idOrSlug), eq(exhibitions.slug, idOrSlug)),
  });
  return row ?? null;
}

export async function listExhibitions(): Promise<Exhibition[]> {
  return db.query.exhibitions.findMany({ orderBy: [asc(exhibitions.startDate)] });
}

export async function getGuide(exhibitionId: string): Promise<GuideSentence[]> {
  return db.query.guideSentences.findMany({
    where: eq(guideSentences.exhibitionId, exhibitionId),
    orderBy: [asc(guideSentences.sequence)],
  });
}

export async function getAudioConfig(
  exhibitionId: string,
): Promise<AudioConfiguration | null> {
  const row = await db.query.audioConfigurations.findFirst({
    where: eq(audioConfigurations.exhibitionId, exhibitionId),
  });
  return row ?? null;
}

/** Group a flat sentence list into sections, preserving order. */
export function groupGuide(sentences: GuideSentence[]) {
  const sections: { section: string | null; sentences: GuideSentence[] }[] = [];
  for (const s of sentences) {
    const last = sections[sections.length - 1];
    if (last && last.section === s.section) last.sentences.push(s);
    else sections.push({ section: s.section, sentences: [s] });
  }
  return sections;
}

/** "2026.10.10 – 2026.12.28" style label. */
export function formatPeriod(e: Pick<Exhibition, "startDate" | "endDate">) {
  const f = (d: string | null) => (d ? d.replaceAll("-", ".") : "");
  if (e.startDate && e.endDate) return `${f(e.startDate)} – ${f(e.endDate)}`;
  return f(e.startDate) || f(e.endDate) || "";
}

/**
 * Public URL for an exhibition (what the QR code encodes).
 * Prefers NEXT_PUBLIC_APP_URL, otherwise the origin of the current request.
 */
export function exhibitionUrl(slug: string, requestOrigin?: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || requestOrigin || "").replace(/\/$/, "");
  return `${base}/e/${slug}`;
}
