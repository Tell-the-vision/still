import { handler, ok, readJson, requireAdmin, type Params } from "@/lib/api";
import { adminResolveReport } from "@/lib/moderation";

/**
 * PATCH /api/admin/reports/{id}
 *   { status: "RESOLVED" | "DISMISSED", action?: "NONE" | "HIDE_EXHIBITION" | "SUSPEND_ARTIST", note? }
 * HIDE_EXHIBITION hides the exhibition; SUSPEND_ARTIST hides it *and* suspends its owner.
 * Other OPEN reports on the same exhibition are closed with the same outcome.
 */
export const PATCH = handler(async (req, { params }: Params<{ id: string }>) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(req);
  const report = await adminResolveReport(admin, id, body);
  return ok({ report });
});
