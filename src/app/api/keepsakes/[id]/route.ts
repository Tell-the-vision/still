import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalKeepsakes } from "@/db/schema";
import {
  handler,
  HttpError,
  noContent,
  ok,
  readJson,
  requireUser,
  type Params,
} from "@/lib/api";
import { getOwnedArchive } from "@/lib/archives";
import {
  isTemplateId,
  parseKeepsakeContent,
  validateKeepsakeContent,
  type KeepsakeContent,
} from "@/lib/keepsake-templates";

async function loadOwned(id: string, userId: string) {
  const row = await db.query.digitalKeepsakes.findFirst({ where: eq(digitalKeepsakes.id, id) });
  if (!row) throw new HttpError("RESOURCE_NOT_FOUND", "웹카드를 찾을 수 없습니다.");
  await getOwnedArchive(row.archiveId, userId); // 403 if not mine
  return row;
}

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

/** GET /api/keepsakes/{id} */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const row = await loadOwned(id, user.id);
  return ok({ keepsake: serialize(row) });
});

/** PUT /api/keepsakes/{id}  { templateId?, content? } */
export const PUT = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  const row = await loadOwned(id, user.id);
  const body = await readJson<{ templateId?: unknown; content?: Partial<KeepsakeContent> }>(req);
  const templateId = body.templateId === undefined ? row.templateId : body.templateId;
  if (!isTemplateId(templateId))
    throw new HttpError("VALIDATION_FAILED", "유효한 templateId가 필요합니다.");
  const content = { ...parseKeepsakeContent(row.contentData), ...(body.content ?? {}) };
  const problem = validateKeepsakeContent(templateId, content);
  if (problem) throw new HttpError("VALIDATION_FAILED", problem);
  const [updated] = await db
    .update(digitalKeepsakes)
    .set({ templateId, contentData: JSON.stringify(content) })
    .where(eq(digitalKeepsakes.id, id))
    .returning();
  return ok({ keepsake: serialize(updated) });
});

/** DELETE /api/keepsakes/{id} */
export const DELETE = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await loadOwned(id, user.id);
  await db.delete(digitalKeepsakes).where(eq(digitalKeepsakes.id, id));
  return noContent();
});

/*
 * GET /keepsakes/{id}/export (PNG) from the spec is intentionally not a
 * server route: PNG export is done client-side with html-to-image so the
 * PNG is pixel-identical to the web card (KEEPSAKE-05). See KeepsakeCard.tsx.
 */
