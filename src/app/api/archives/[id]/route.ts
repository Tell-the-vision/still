import { handler, HttpError, noContent, ok, requireUser, type Params } from "@/lib/api";
import { deleteArchive, getArchiveDetail, getOwnedArchive } from "@/lib/archives";
import { parseKeepsakeContent } from "@/lib/keepsake-templates";

/** GET /api/archives/{id} — archive detail with scraps, journal, keepsakes. */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const detail = await getArchiveDetail(id);
  if (!detail) throw new HttpError("RESOURCE_NOT_FOUND", "Archive를 찾을 수 없습니다.");
  return ok({
    archive: {
      id: detail.id,
      exhibitionId: detail.exhibitionId,
      firstVisitedAt: detail.firstVisitedAt,
      lastVisitedAt: detail.lastVisitedAt,
      exhibition: detail.exhibition,
      scraps: detail.scraps,
      journal: detail.journal ?? null,
      keepsakes: detail.keepsakes.map((k) => ({
        id: k.id,
        templateId: k.templateId,
        content: parseKeepsakeContent(k.contentData),
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      })),
    },
  });
});

/** DELETE /api/archives/{id} — cascade delete (DETAIL-05). */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  await deleteArchive(id);
  return noContent();
});
