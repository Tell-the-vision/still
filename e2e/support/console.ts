import { randomUUID } from "node:crypto";
import { e2eSql, type InstitutionAccount } from "./staff";

export type SeededExhibition = { id: string; code: string; title: string; venueId: string; draftRevision: string };

// Test setup only: an exhibition of `account`'s institution as the console would leave it
// (SPEC §10.3, §10.9). PUBLISHED / UNPUBLISHED rows get the venue and period the CHECKs require.
export async function seedExhibition(
  account: InstitutionAccount,
  opts: { title?: string; state?: "DRAFT" | "PUBLISHED" | "UNPUBLISHED"; startDate?: string; endDate?: string } = {},
): Promise<SeededExhibition> {
  const tag = randomUUID().slice(0, 8);
  const { title = `E2E Exhibition ${tag}`, state = "DRAFT", startDate = "2026-01-01", endDate = "2030-12-31" } = opts;
  const [venue] = await e2eSql<{ id: string }>(
    "INSERT INTO venues (code, name, city, created_by_institution_id) VALUES ($1, $2, 'Seoul', $3) RETURNING id",
    [`e2e-venue-${tag}`, `E2E Hall ${tag}`, account.institutionId],
  );
  const revision = randomUUID();
  const published = state !== "DRAFT";
  const draft = { version: 1, title, subtitle: null, venueId: venue.id, startDate, endDate, coverImageId: null, ambienceEnabled: false, playlist: null, sections: [] };
  const [row] = await e2eSql<{ id: string; code: string }>(
    `INSERT INTO exhibitions (code, institution_id, venue_id, title, start_date, end_date, state, draft, draft_revision,
       first_published_at, published_at, published_revision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11) RETURNING id, code`,
    [`e2e-${tag}`, account.institutionId, venue.id, title, startDate, endDate, state, JSON.stringify(draft), revision,
      published ? new Date() : null, published ? revision : null],
  );
  return { id: row.id, code: row.code, title, venueId: venue.id, draftRevision: revision };
}
