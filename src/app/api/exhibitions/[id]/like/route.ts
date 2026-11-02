import { currentUser, handler, HttpError, noContent, ok, requireUser, type Params } from "@/lib/api";
import { findExhibition } from "@/lib/exhibitions";
import { likeSummary, setLike } from "@/lib/moderation";

async function load(id: string) {
  const ex = await findExhibition(id);
  if (!ex) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  return ex;
}

/** GET /api/exhibitions/{id}/like → { count, liked } (liked=false for guests). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const ex = await load(id);
  const user = await currentUser();
  return ok(await likeSummary(ex.id, user?.id));
});

/** POST /api/exhibitions/{id}/like → like (idempotent). */
export const POST = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await load(id);
  return ok(await setLike(ex.id, user.id, true));
});

/** DELETE /api/exhibitions/{id}/like → unlike. */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await load(id);
  await setLike(ex.id, user.id, false);
  return noContent();
});
