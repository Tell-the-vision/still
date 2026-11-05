// Visitor-facing rows are only PUBLISHED or UNPUBLISHED exhibitions. For those, the CHECK
// exhibitions_published_fields_check guarantees a venue and dates, so these helpers narrow the
// nullable DRAFT-only columns in one place instead of scattering `!`.

type Complete<T extends { venue: unknown; startDate: unknown; endDate: unknown }> = T & {
  venue: NonNullable<T["venue"]>;
  startDate: string;
  endDate: string;
};

export function completeExhibition<T extends { code: string; venue: unknown; startDate: string | null; endDate: string | null }>(row: T): Complete<T> {
  const { venue, startDate, endDate } = row;
  if (!venue || !startDate || !endDate) throw new Error(`Exhibition "${row.code}" is served but has no venue or dates`);
  return { ...row, venue, startDate, endDate } as Complete<T>;
}

// Images without a public copy (object_key IS NULL, SPEC §10.3) never reach visitors.
export function hasPublicCopy<T extends { objectKey: string | null }>(image: T | null | undefined): image is T & { objectKey: string } {
  return image != null && image.objectKey !== null;
}
