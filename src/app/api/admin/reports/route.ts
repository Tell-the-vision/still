import { handler, ok, requireAdmin } from "@/lib/api";
import { adminListReports, REPORT_REASON_LABEL } from "@/lib/moderation";

/** GET /api/admin/reports?status=OPEN|RESOLVED|DISMISSED */
export const GET = handler(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const rows = await adminListReports(status || undefined);
  return ok({
    reports: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      reasonLabel: REPORT_REASON_LABEL[r.reason],
      detail: r.detail,
      status: r.status,
      action: r.action,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      exhibition: r.exhibition,
      reporter: r.reporter,
      resolvedBy: r.resolvedBy,
    })),
  });
});
