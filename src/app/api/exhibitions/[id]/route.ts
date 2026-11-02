import { apiError, handler, ok, type Params } from "@/lib/api";
import { findExhibition } from "@/lib/exhibitions";

/** GET /api/exhibitions/{id|slug} — exhibition detail (public). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const exhibition = await findExhibition(id);
  if (!exhibition) return apiError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  return ok({ exhibition });
});
