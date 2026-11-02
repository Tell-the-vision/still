import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scraps } from "@/db/schema";
import { handler, HttpError, ok, readJson, requireUser, type Params } from "@/lib/api";
import { addScrap, getOwnedArchive } from "@/lib/archives";

/** GET /api/archives/{id}/scraps */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const rows = await db.query.scraps.findMany({
    where: eq(scraps.archiveId, id),
    orderBy: [desc(scraps.createdAt)],
  });
  return ok({ scraps: rows });
});

/**
 * POST /api/archives/{id}/scraps  { guideSentenceId }
 * 201 when saved, 200 when the sentence was already saved (idempotent;
 * GUIDE-04 "중복 저장 요청은 서버에서 방지").
 */
export const POST = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const archive = await getOwnedArchive(id, user.id);
  const body = await readJson<{ guideSentenceId?: string }>(req);
  if (!body.guideSentenceId)
    throw new HttpError("VALIDATION_FAILED", "guideSentenceId가 필요합니다.");
  const { scrap, created } = await addScrap(archive, body.guideSentenceId);
  return ok({ scrap, created }, created ? 201 : 200);
});
