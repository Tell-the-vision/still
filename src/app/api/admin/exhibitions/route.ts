import { handler, ok, requireAdmin } from "@/lib/api";
import { adminListExhibitions } from "@/lib/moderation";

/** GET /api/admin/exhibitions?q=&status=&reported=1 */
export const GET = handler(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const rows = await adminListExhibitions({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    reported: url.searchParams.get("reported") === "1",
  });
  return ok({ exhibitions: rows });
});
