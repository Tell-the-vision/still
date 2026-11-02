/**
 * Likes, reports and admin moderation (server-only).
 */
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exhibitionLikes,
  exhibitionReports,
  exhibitions,
  REPORT_REASON,
  users,
  type ReportAction,
  type ReportReason,
  type User,
} from "@/db/schema";
import { HttpError } from "./api";

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  INAPPROPRIATE: "부적절한 콘텐츠",
  COPYRIGHT: "저작권 침해",
  SPAM: "스팸 / 광고",
  OTHER: "기타",
};
export const REPORT_DETAIL_MAX = 500;

// ---------------------------------------------------------------- likes
export async function likeSummary(exhibitionId: string, userId?: string | null) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(exhibitionLikes)
    .where(eq(exhibitionLikes.exhibitionId, exhibitionId));
  let liked = false;
  if (userId) {
    const hit = await db.query.exhibitionLikes.findFirst({
      where: and(eq(exhibitionLikes.exhibitionId, exhibitionId), eq(exhibitionLikes.userId, userId)),
      columns: { id: true },
    });
    liked = Boolean(hit);
  }
  return { count: n, liked };
}

export async function setLike(exhibitionId: string, userId: string, liked: boolean) {
  if (liked) {
    try {
      await db.insert(exhibitionLikes).values({ exhibitionId, userId });
    } catch {
      /* already liked (unique) */
    }
  } else {
    await db
      .delete(exhibitionLikes)
      .where(and(eq(exhibitionLikes.exhibitionId, exhibitionId), eq(exhibitionLikes.userId, userId)));
  }
  return likeSummary(exhibitionId, userId);
}

// -------------------------------------------------------------- reports
export async function createReport(
  exhibitionId: string,
  reporter: User,
  input: { reason?: unknown; detail?: unknown },
) {
  const reason = typeof input.reason === "string" ? input.reason : "";
  if (!(REPORT_REASON as readonly string[]).includes(reason))
    throw new HttpError("VALIDATION_FAILED", "신고 사유를 선택해 주세요.");
  const detail = typeof input.detail === "string" ? input.detail.trim() : "";
  if (detail.length > REPORT_DETAIL_MAX)
    throw new HttpError("VALIDATION_FAILED", `상세 내용은 ${REPORT_DETAIL_MAX}자 이내여야 합니다.`);
  if (reason === "OTHER" && !detail)
    throw new HttpError("VALIDATION_FAILED", "기타 사유를 선택한 경우 내용을 적어 주세요.");

  const open = await db.query.exhibitionReports.findFirst({
    where: and(
      eq(exhibitionReports.exhibitionId, exhibitionId),
      eq(exhibitionReports.reporterId, reporter.id),
      eq(exhibitionReports.status, "OPEN"),
    ),
  });
  if (open) return { report: open, created: false };

  const [row] = await db
    .insert(exhibitionReports)
    .values({ exhibitionId, reporterId: reporter.id, reason: reason as ReportReason, detail: detail || null })
    .returning();
  return { report: row, created: true };
}

export async function myReportStatus(exhibitionId: string, userId: string) {
  const open = await db.query.exhibitionReports.findFirst({
    where: and(
      eq(exhibitionReports.exhibitionId, exhibitionId),
      eq(exhibitionReports.reporterId, userId),
      eq(exhibitionReports.status, "OPEN"),
    ),
    columns: { id: true, createdAt: true },
  });
  return { reported: Boolean(open) };
}

// ----------------------------------------------------------------- admin
export async function adminStats() {
  const [u] = await db.select({ n: count() }).from(users);
  const [pending] = await db.select({ n: count() }).from(users).where(eq(users.artistStatus, "PENDING"));
  const [ex] = await db.select({ n: count() }).from(exhibitions).where(sql`${exhibitions.status} != 'DELETED'`);
  const [active] = await db.select({ n: count() }).from(exhibitions).where(eq(exhibitions.status, "ACTIVE"));
  const [open] = await db.select({ n: count() }).from(exhibitionReports).where(eq(exhibitionReports.status, "OPEN"));
  const [suspended] = await db.select({ n: count() }).from(users).where(eq(users.status, "SUSPENDED"));
  return {
    users: u.n,
    pendingArtists: pending.n,
    exhibitions: ex.n,
    activeExhibitions: active.n,
    openReports: open.n,
    suspendedUsers: suspended.n,
  };
}

export async function adminListUsers(opts: { q?: string; filter?: string }) {
  const conds = [];
  if (opts.q) {
    const q = `%${opts.q}%`;
    conds.push(or(like(users.email, q), like(users.displayName, q), like(users.artistName, q)));
  }
  if (opts.filter === "pending") conds.push(eq(users.artistStatus, "PENDING"));
  if (opts.filter === "artists") conds.push(eq(users.role, "ARTIST"));
  if (opts.filter === "admins") conds.push(eq(users.role, "ADMIN"));
  if (opts.filter === "suspended") conds.push(eq(users.status, "SUSPENDED"));
  return db.query.users.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [desc(users.createdAt)],
    limit: 200,
    with: {
      exhibitions: { columns: { id: true, status: true } },
      archives: { columns: { id: true } },
    },
  });
}

export async function adminGetUser(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      exhibitions: {
        orderBy: [desc(exhibitions.updatedAt)],
        with: { likes: { columns: { id: true } }, reports: { columns: { id: true, status: true } } },
      },
      archives: { columns: { id: true } },
    },
  });
}

export async function adminReviewArtist(
  admin: User,
  target: User,
  decision: "APPROVE" | "REJECT",
  note?: string | null,
) {
  if (target.artistStatus !== "PENDING" && decision === "APPROVE" && target.role === "ARTIST")
    throw new HttpError("CONFLICT", "이미 승인된 아티스트입니다.");
  const [row] = await db
    .update(users)
    .set(
      decision === "APPROVE"
        ? { role: target.role === "ADMIN" ? "ADMIN" : "ARTIST", artistStatus: "APPROVED", artistReviewedAt: new Date(), artistReviewNote: note ?? null }
        : { role: target.role === "ARTIST" ? "USER" : target.role, artistStatus: "REJECTED", artistReviewedAt: new Date(), artistReviewNote: note ?? null },
    )
    .where(eq(users.id, target.id))
    .returning();
  void admin;
  return row;
}

export async function adminSetUserRole(target: User, role: "USER" | "ARTIST" | "ADMIN") {
  const patch: Partial<typeof users.$inferInsert> = { role };
  if (role === "ARTIST") patch.artistStatus = "APPROVED";
  if (role === "USER" && target.artistStatus === "APPROVED") patch.artistStatus = "NONE";
  const [row] = await db.update(users).set(patch).where(eq(users.id, target.id)).returning();
  return row;
}

export async function adminSetUserStatus(target: User, status: "ACTIVE" | "SUSPENDED", reason?: string | null) {
  const [row] = await db
    .update(users)
    .set({ status, suspendedReason: status === "SUSPENDED" ? (reason ?? null) : null })
    .where(eq(users.id, target.id))
    .returning();
  return row;
}

export async function adminListExhibitions(opts: { q?: string; status?: string; reported?: boolean }) {
  const conds = [];
  if (opts.q) {
    const q = `%${opts.q}%`;
    conds.push(or(like(exhibitions.title, q), like(exhibitions.slug, q), like(exhibitions.venue, q)));
  }
  if (opts.status) conds.push(eq(exhibitions.status, opts.status as "DRAFT"));
  const rows = await db.query.exhibitions.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [desc(exhibitions.updatedAt)],
    limit: 300,
    with: {
      owner: { columns: { id: true, displayName: true, artistName: true, email: true, status: true } },
      likes: { columns: { id: true } },
      reports: { columns: { id: true, status: true } },
      archives: { columns: { id: true } },
    },
  });
  const mapped = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    venue: r.venue,
    status: r.status,
    coverImageUrl: r.coverImageUrl,
    startDate: r.startDate,
    endDate: r.endDate,
    owner: r.owner,
    likeCount: r.likes.length,
    openReportCount: r.reports.filter((x) => x.status === "OPEN").length,
    reportCount: r.reports.length,
    archiveCount: r.archives.length,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
  return opts.reported ? mapped.filter((m) => m.openReportCount > 0) : mapped;
}

export async function adminListReports(status?: string) {
  const rows = await db.query.exhibitionReports.findMany({
    where: status ? eq(exhibitionReports.status, status as "OPEN") : undefined,
    orderBy: [desc(exhibitionReports.createdAt)],
    limit: 300,
    with: {
      exhibition: {
        columns: { id: true, slug: true, title: true, status: true, ownerId: true },
        with: { owner: { columns: { id: true, displayName: true, artistName: true, email: true, status: true } } },
      },
      reporter: { columns: { id: true, displayName: true, email: true } },
      resolvedBy: { columns: { id: true, displayName: true } },
    },
  });
  return rows;
}

/** Close a report, optionally hiding the exhibition or suspending its artist. */
export async function adminResolveReport(
  admin: User,
  reportId: string,
  input: { status?: unknown; action?: unknown; note?: unknown },
) {
  const report = await db.query.exhibitionReports.findFirst({
    where: eq(exhibitionReports.id, reportId),
    with: { exhibition: { columns: { id: true, ownerId: true, status: true } } },
  });
  if (!report) throw new HttpError("RESOURCE_NOT_FOUND", "신고를 찾을 수 없습니다.");
  const status = input.status === "DISMISSED" ? "DISMISSED" : "RESOLVED";
  const action = (typeof input.action === "string" ? input.action : "NONE") as ReportAction;
  if (!["NONE", "HIDE_EXHIBITION", "SUSPEND_ARTIST"].includes(action))
    throw new HttpError("VALIDATION_FAILED", "조치 값이 올바르지 않습니다.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : null;

  await db.transaction(async (tx) => {
    if (status === "RESOLVED" && (action === "HIDE_EXHIBITION" || action === "SUSPEND_ARTIST")) {
      await tx.update(exhibitions).set({ status: "HIDDEN" }).where(eq(exhibitions.id, report.exhibition.id));
    }
    if (status === "RESOLVED" && action === "SUSPEND_ARTIST" && report.exhibition.ownerId) {
      await tx
        .update(users)
        .set({ status: "SUSPENDED", suspendedReason: note || "신고 누적으로 정지되었습니다." })
        .where(eq(users.id, report.exhibition.ownerId));
    }
    await tx
      .update(exhibitionReports)
      .set({ status, action, resolutionNote: note || null, resolvedById: admin.id, resolvedAt: new Date() })
      .where(eq(exhibitionReports.id, reportId));
    // Close sibling OPEN reports on the same exhibition with the same outcome.
    if (status === "RESOLVED" && action !== "NONE") {
      await tx
        .update(exhibitionReports)
        .set({ status, action, resolutionNote: note || null, resolvedById: admin.id, resolvedAt: new Date() })
        .where(and(eq(exhibitionReports.exhibitionId, report.exhibition.id), eq(exhibitionReports.status, "OPEN")));
    }
  });
  return db.query.exhibitionReports.findFirst({ where: eq(exhibitionReports.id, reportId) });
}
