import { handler, HttpError, isAdmin, ok, readJson, requireUser, type Params } from "@/lib/api";
import { getManagedExhibition, setExhibitionStatus } from "@/lib/artist";

/**
 * POST /api/artist/exhibitions/{id}/status  { status: "ACTIVE" | "DRAFT" }
 * Publish / unpublish. Requires at least one guide sentence to publish.
 * An exhibition HIDDEN by an admin cannot be re-published by its owner.
 */
export const POST = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await getManagedExhibition(user, id);
  const { status } = await readJson<{ status?: string }>(req);
  if (status !== "ACTIVE" && status !== "DRAFT")
    throw new HttpError("VALIDATION_FAILED", "status는 ACTIVE 또는 DRAFT여야 합니다.");
  if (ex.status === "HIDDEN" && !isAdmin(user))
    throw new HttpError("FORBIDDEN", "관리자가 숨긴 전시입니다. 관리자에게 문의해 주세요.");
  const row = await setExhibitionStatus(ex, status);
  return ok({ exhibition: row });
});
