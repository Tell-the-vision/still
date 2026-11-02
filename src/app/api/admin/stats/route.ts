import { handler, ok, requireAdmin } from "@/lib/api";
import { adminStats } from "@/lib/moderation";

/** GET /api/admin/stats */
export const GET = handler(async () => {
  await requireAdmin();
  return ok(await adminStats());
});
