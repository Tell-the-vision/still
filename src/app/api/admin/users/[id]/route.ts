import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handler, HttpError, noContent, ok, publicUser, readJson, requireAdmin, type Params } from "@/lib/api";
import { deleteUserCompletely } from "@/lib/archives";
import { adminGetUser, adminReviewArtist, adminSetUserRole, adminSetUserStatus } from "@/lib/moderation";

/** GET /api/admin/users/{id} — user with their exhibitions. */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  await requireAdmin();
  const { id } = await params;
  const u = await adminGetUser(id);
  if (!u) throw new HttpError("RESOURCE_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  return ok({
    user: { ...publicUser(u), archiveCount: u.archives.length },
    exhibitions: u.exhibitions.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      status: e.status,
      likeCount: e.likes.length,
      openReportCount: e.reports.filter((r) => r.status === "OPEN").length,
      updatedAt: e.updatedAt,
    })),
  });
});

/**
 * PATCH /api/admin/users/{id}
 *   { artistDecision: "APPROVE" | "REJECT", note? }   — review an artist application
 *   { role: "USER" | "ARTIST" | "ADMIN" }              — change role directly
 *   { status: "ACTIVE" | "SUSPENDED", reason? }        — suspend / reinstate
 */
export const PATCH = handler(async (req, { params }: Params<{ id: string }>) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new HttpError("RESOURCE_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const body = await readJson<{ artistDecision?: string; note?: string; role?: string; status?: string; reason?: string }>(req);

  let updated = target;
  if (body.artistDecision === "APPROVE" || body.artistDecision === "REJECT") {
    updated = await adminReviewArtist(admin, updated, body.artistDecision, body.note ?? null);
  }
  if (body.role) {
    if (!["USER", "ARTIST", "ADMIN"].includes(body.role)) throw new HttpError("VALIDATION_FAILED", "role 값이 올바르지 않습니다.");
    if (target.id === admin.id && body.role !== "ADMIN")
      throw new HttpError("VALIDATION_FAILED", "자신의 관리자 권한은 해제할 수 없습니다.");
    updated = await adminSetUserRole(updated, body.role as "USER");
  }
  if (body.status) {
    if (!["ACTIVE", "SUSPENDED"].includes(body.status)) throw new HttpError("VALIDATION_FAILED", "status 값이 올바르지 않습니다.");
    if (target.id === admin.id) throw new HttpError("VALIDATION_FAILED", "자신의 계정은 정지할 수 없습니다.");
    updated = await adminSetUserStatus(updated, body.status as "ACTIVE", body.reason ?? null);
  }
  return ok({ user: publicUser(updated) });
});

/** DELETE /api/admin/users/{id} — remove the account and all personal records. */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (id === admin.id) throw new HttpError("VALIDATION_FAILED", "자신의 계정은 여기서 삭제할 수 없습니다.");
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new HttpError("RESOURCE_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  await deleteUserCompletely(id);
  return noContent();
});
