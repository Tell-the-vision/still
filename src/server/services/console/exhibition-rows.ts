import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { exhibitions, venues } from "../../db/schema";

// One exhibition as the institution console lists it (SPEC §9.4 목록, Figma A8). Titles, venue
// and dates come from the draft the institution is editing, not from the published copy.
export type ConsoleExhibitionRow = {
  id: string;
  code: string;
  state: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  // DRAFT and UNPUBLISHED as they are; PUBLISHED by today (Asia/Seoul) against the published period.
  displayStatus: "DRAFT" | "UNPUBLISHED" | "SCHEDULED" | "LIVE" | "ENDED";
  title: string;
  subtitle: string | null;
  venue: { id: string; name: string; city: string } | null;
  startDate: string | null;
  endDate: string | null;
  draftRevision: string;
  // Published, and the draft has been edited since (SPEC §9.4: draft edits do not affect the live version).
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

// The draft's venue: draft.venueId → venues (SPEC §10.9).
const draftVenueJoin = sql`${venues.id} = (${exhibitions.draft} ->> 'venueId')::uuid`;
export const draftTitle = sql<string>`${exhibitions.draft} ->> 'title'`;

// The institution's exhibitions matching `where`, most recently updated first (ties by id).
export async function exhibitionRows(institutionId: string, { where, limit }: { where?: SQL; limit?: number } = {}): Promise<ConsoleExhibitionRow[]> {
  const rows = await db
    .select({
      exhibition: exhibitions,
      venue: { id: venues.id, name: venues.name, city: venues.city },
    })
    .from(exhibitions)
    .leftJoin(venues, draftVenueJoin)
    .where(and(eq(exhibitions.institutionId, institutionId), where))
    .orderBy(desc(exhibitions.updatedAt), desc(exhibitions.id))
    .limit(limit ?? 10_000);
  const today = seoulToday();
  return rows.map(({ exhibition: e, venue }) => {
    const draft = e.draft as { title: string; subtitle: string | null; startDate: string | null; endDate: string | null };
    const state = e.state as ConsoleExhibitionRow["state"];
    return {
      id: e.id,
      code: e.code,
      state,
      displayStatus: displayStatusOf(state, e.startDate, e.endDate, today),
      title: draft.title,
      subtitle: draft.subtitle,
      venue,
      startDate: draft.startDate,
      endDate: draft.endDate,
      draftRevision: e.draftRevision,
      hasUnpublishedChanges: state !== "DRAFT" && e.publishedRevision !== e.draftRevision,
      publishedAt: e.publishedAt?.toISOString() ?? null,
      updatedAt: e.updatedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    };
  });
}

// A published row always has its period (exhibitions_published_fields_check).
function displayStatusOf(state: ConsoleExhibitionRow["state"], start: string | null, end: string | null, today: string) {
  if (state !== "PUBLISHED") return state;
  if (start && today < start) return "SCHEDULED";
  if (end && today > end) return "ENDED";
  return "LIVE";
}
