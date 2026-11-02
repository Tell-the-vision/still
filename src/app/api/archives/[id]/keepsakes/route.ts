import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalKeepsakes } from "@/db/schema";
import { handler, HttpError, ok, readJson, requireUser, type Params } from "@/lib/api";
import { getOwnedArchive } from "@/lib/archives";
import {
  isTemplateId,
  normalizeTheme,
  parseKeepsakeContent,
  validateKeepsakeContent,
  type KeepsakeContent,
} from "@/lib/keepsake-templates";

function serialize(k: typeof digitalKeepsakes.$inferSelect) {
  return {
    id: k.id,
    archiveId: k.archiveId,
    templateId: k.templateId,
    content: parseKeepsakeContent(k.contentData),
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}

/** GET /api/archives/{id}/keepsakes */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const rows = await db.query.digitalKeepsakes.findMany({
    where: eq(digitalKeepsakes.archiveId, id),
    orderBy: [desc(digitalKeepsakes.createdAt)],
  });
  return ok({ keepsakes: rows.map(serialize) });
});

/**
 * POST /api/archives/{id}/keepsakes  { templateId, content: KeepsakeContent }
 * One keepsake per exhibition (PO decision, "전시 1개당 1개"): saving again
 * REPLACES the existing card. 201 when created, 200 when replaced
 * (`replaced: true`). The theme is normalised and frozen into the content.
 */
export const POST = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const body = await readJson<{ templateId?: unknown; content?: Partial<KeepsakeContent> }>(req);
  if (!isTemplateId(body.templateId))
    throw new HttpError("VALIDATION_FAILED", "유효한 templateId가 필요합니다.");
  const content: Partial<KeepsakeContent> = { ...(body.content ?? {}), theme: normalizeTheme(body.content?.theme) };
  const problem = validateKeepsakeContent(body.templateId, content);
  if (problem) throw new HttpError("VALIDATION_FAILED", problem);

  const existing = await db.query.digitalKeepsakes.findFirst({ where: eq(digitalKeepsakes.archiveId, id) });
  if (existing) {
    const [row] = await db
      .update(digitalKeepsakes)
      .set({ templateId: body.templateId, contentData: JSON.stringify(content) })
      .where(eq(digitalKeepsakes.id, existing.id))
      .returning();
    return ok({ keepsake: serialize(row), replaced: true });
  }
  try {
    const [row] = await db
      .insert(digitalKeepsakes)
      .values({ archiveId: id, templateId: body.templateId, contentData: JSON.stringify(content) })
      .returning();
    return ok({ keepsake: serialize(row), replaced: false }, 201);
  } catch {
    // Lost a race → unique(archive_id) fired → update the winner instead.
    const again = await db.query.digitalKeepsakes.findFirst({ where: eq(digitalKeepsakes.archiveId, id) });
    if (!again) throw new HttpError("INTERNAL_ERROR", "웹카드를 저장하지 못했습니다.");
    const [row] = await db
      .update(digitalKeepsakes)
      .set({ templateId: body.templateId, contentData: JSON.stringify(content) })
      .where(eq(digitalKeepsakes.id, again.id))
      .returning();
    return ok({ keepsake: serialize(row), replaced: true });
  }
});
