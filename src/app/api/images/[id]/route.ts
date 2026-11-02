import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";
import { apiError, handler, type Params } from "@/lib/api";

/** GET /api/images/{id} — serves an uploaded image (public, cacheable). */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const row = await db.query.images.findFirst({ where: eq(images.id, id) });
  if (!row) return apiError("RESOURCE_NOT_FOUND", "이미지를 찾을 수 없습니다.");
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
