import { handler, ok } from "@/lib/api";
import { listExhibitions } from "@/lib/exhibitions";

/**
 * GET /api/exhibitions — all exhibitions.
 * Not a product screen (users enter via QR / URL); used by the /dev helper page.
 */
export const GET = handler(async () => {
  const rows = await listExhibitions();
  return ok({ exhibitions: rows });
});
