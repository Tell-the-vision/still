import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exhibitions } from "@/db/schema";
import { handler, HttpError, noContent, ok, readJson, requireAdmin, type Params } from "@/lib/api";
import { hardDeleteExhibition, setExhibitionStatus } from "@/lib/artist";

/** PATCH /api/admin/exhibitions/{id}  { status: DRAFT|ACTIVE|HIDDEN|DELETED } */
export const PATCH = handler(async (req, { params }: Params<{ id: string }>) => {
  await requireAdmin();
  const { id } = await params;
  const ex = await db.query.exhibitions.findFirst({ where: eq(exhibitions.id, id) });
  if (!ex) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  const { status } = await readJson<{ status?: string }>(req);
  if (!["DRAFT", "ACTIVE", "HIDDEN", "DELETED"].includes(status ?? ""))
    throw new HttpError("VALIDATION_FAILED", "status 값이 올바르지 않습니다.");
  const row = await setExhibitionStatus(ex, status as "DRAFT");
  return ok({ exhibition: row });
});

/** DELETE /api/admin/exhibitions/{id} — HARD delete (also removes visitors' archives of it). */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  await requireAdmin();
  const { id } = await params;
  const ex = await db.query.exhibitions.findFirst({ where: eq(exhibitions.id, id), columns: { id: true } });
  if (!ex) throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  await hardDeleteExhibition(id);
  return noContent();
});
