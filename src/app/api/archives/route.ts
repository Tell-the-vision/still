import { handler, HttpError, ok, readJson, requireUser } from "@/lib/api";
import { getOrCreateArchive, listArchives } from "@/lib/archives";
import { findExhibition } from "@/lib/exhibitions";

/** GET /api/archives — my archives (most recently visited first). */
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await listArchives(user.id);
  return ok({
    archives: rows.map((a) => ({
      id: a.id,
      exhibitionId: a.exhibitionId,
      firstVisitedAt: a.firstVisitedAt,
      lastVisitedAt: a.lastVisitedAt,
      exhibition: a.exhibition,
      scrapCount: a.scraps.length,
      hasJournal: Boolean(a.journal),
      keepsakeCount: a.keepsakes.length,
    })),
    count: rows.length,
  });
});

/**
 * POST /api/archives  { exhibitionId }   (id or slug)
 * Creates the archive for user × exhibition, or returns the existing one
 * with last_visited_at refreshed. 201 when created, 200 when reused.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ exhibitionId?: string }>(req);
  if (!body.exhibitionId) throw new HttpError("VALIDATION_FAILED", "exhibitionId가 필요합니다.");
  const exhibition = await findExhibition(body.exhibitionId);
  if (!exhibition) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  const { archive, created } = await getOrCreateArchive(user.id, exhibition.id);
  return ok({ archive, created }, created ? 201 : 200);
});
