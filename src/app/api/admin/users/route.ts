import { handler, ok, publicUser, requireAdmin } from "@/lib/api";
import { adminListUsers } from "@/lib/moderation";

/** GET /api/admin/users?q=&filter=pending|artists|admins|suspended */
export const GET = handler(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const rows = await adminListUsers({
    q: url.searchParams.get("q") ?? undefined,
    filter: url.searchParams.get("filter") ?? undefined,
  });
  return ok({
    users: rows.map((u) => ({
      ...publicUser(u),
      exhibitionCount: u.exhibitions.filter((e) => e.status !== "DELETED").length,
      archiveCount: u.archives.length,
    })),
  });
});
