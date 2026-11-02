import { asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  audioConfigurations,
  exhibitions,
  guideSentences,
  type AudioConfiguration,
  type Exhibition,
  type GuideSentence,
  type User,
} from "@/db/schema";

/** Visible to the public: published, and the owner (if any) is not suspended. */
export function isPubliclyVisible(
  ex: Pick<Exhibition, "status">,
  owner: Pick<User, "status"> | null | undefined,
) {
  return ex.status === "ACTIVE" && (!owner || owner.status === "ACTIVE");
}

/** Resolve an exhibition by id *or* slug, regardless of status (artist/admin use). */
export async function findExhibitionAny(idOrSlug: string) {
  const row = await db.query.exhibitions.findFirst({
    where: or(eq(exhibitions.id, idOrSlug), eq(exhibitions.slug, idOrSlug)),
    with: { owner: { columns: { id: true, status: true, displayName: true, artistName: true } } },
  });
  return row ?? null;
}

/** Resolve a *publicly visible* exhibition by id or slug (guest-facing use). */
export async function findExhibition(idOrSlug: string): Promise<Exhibition | null> {
  const row = await findExhibitionAny(idOrSlug);
  if (!row || !isPubliclyVisible(row, row.owner)) return null;
  // strip the relation so callers get a plain row
  const { owner: _owner, ...plain } = row;
  void _owner;
  return plain;
}

/** All publicly visible exhibitions. */
export async function listExhibitions(): Promise<Exhibition[]> {
  const rows = await db.query.exhibitions.findMany({
    orderBy: [asc(exhibitions.startDate)],
    with: { owner: { columns: { status: true } } },
  });
  return rows
    .filter((r) => isPubliclyVisible(r, r.owner))
    .map(({ owner: _o, ...plain }) => {
      void _o;
      return plain;
    });
}

export async function listExhibitionsByOwner(ownerId: string) {
  return db.query.exhibitions.findMany({
    where: eq(exhibitions.ownerId, ownerId),
    orderBy: [desc(exhibitions.updatedAt)],
    with: {
      likes: { columns: { id: true } },
      reports: { columns: { id: true, status: true } },
      archives: { columns: { id: true } },
    },
  });
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
