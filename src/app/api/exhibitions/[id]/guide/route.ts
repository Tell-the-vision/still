import { apiError, handler, ok, type Params } from "@/lib/api";
import { findExhibition, getGuide, groupGuide } from "@/lib/exhibitions";

/** GET /api/exhibitions/{id|slug}/guide — commentary guide sentences (public). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const exhibition = await findExhibition(id);
  if (!exhibition) return apiError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  const sentences = await getGuide(exhibition.id);
  return ok({ exhibitionId: exhibition.id, sentences, sections: groupGuide(sentences) });
});
