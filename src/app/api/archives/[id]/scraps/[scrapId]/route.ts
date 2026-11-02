import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scraps } from "@/db/schema";
import { handler, HttpError, noContent, requireUser, type Params } from "@/lib/api";
import { getOwnedArchive } from "@/lib/archives";

/**
 * DELETE /api/archives/{id}/scraps/{scrapId} — un-save a sentence.
 * TBD-01: implemented server-side; the UI exposes it as a toggle
 * (Saved → tap again to remove). Hide the control if the policy changes.
 */
export const DELETE = handler(
  async (_req, { params }: Params<{ id: string; scrapId: string }>) => {
    const user = await requireUser();
    const { id, scrapId } = await params;
    await getOwnedArchive(id, user.id);
    const row = await db.query.scraps.findFirst({
      where: and(eq(scraps.id, scrapId), eq(scraps.archiveId, id)),
    });
    if (!row) throw new HttpError("RESOURCE_NOT_FOUND", "저장된 문장을 찾을 수 없습니다.");
    await db.delete(scraps).where(eq(scraps.id, scrapId));
    return noContent();
  },
);
