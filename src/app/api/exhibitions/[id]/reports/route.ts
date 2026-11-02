import { handler, HttpError, ok, readJson, requireUser, type Params } from "@/lib/api";
import { findExhibition } from "@/lib/exhibitions";
import { createReport, myReportStatus } from "@/lib/moderation";

/** GET /api/exhibitions/{id}/reports → { reported } (whether *I* have an open report). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await findExhibition(id);
  if (!ex) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  return ok(await myReportStatus(ex.id, user.id));
});

/**
 * POST /api/exhibitions/{id}/reports  { reason: INAPPROPRIATE|COPYRIGHT|SPAM|OTHER, detail? }
 * One open report per user per exhibition (201 created / 200 already open).
 */
export const POST = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const ex = await findExhibition(id);
  if (!ex) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  if (ex.ownerId === user.id) throw new HttpError("VALIDATION_FAILED", "자신의 전시는 신고할 수 없습니다.");
  const body = await readJson(req);
  const { report, created } = await createReport(ex.id, user, body);
  return ok({ report: { id: report.id, status: report.status, createdAt: report.createdAt }, created }, created ? 201 : 200);
});
