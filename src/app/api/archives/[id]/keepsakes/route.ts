import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalKeepsakes } from "@/db/schema";
import { handler, HttpError, ok, readJson, requireUser, type Params } from "@/lib/api";
import { getOwnedArchive } from "@/lib/archives";
import {
  isTemplateId,
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
 * TBD-02: multiple keepsakes per archive are allowed (1 : N).
 */
export const POST = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const body = await readJson<{ templateId?: unknown; content?: Partial<KeepsakeContent> }>(req);
  if (!isTemplateId(body.templateId))
    throw new HttpError("VALIDATION_FAILED", "유효한 templateId가 필요합니다.");
  const content = body.content ?? {};
  const problem = validateKeepsakeContent(body.templateId, content);
  if (problem) throw new HttpError("VALIDATION_FAILED", problem);

  const [row] = await db
    .insert(digitalKeepsakes)
    .values({
      archiveId: id,
      templateId: body.templateId,
      contentData: JSON.stringify(content),
    })
    .returning();
  return ok({ keepsake: serialize(row) }, 201);
});
