import { eq } from "drizzle-orm";
import { db } from "@/db";
import { journals } from "@/db/schema";
import { handler, HttpError, ok, readJson, requireUser, type Params } from "@/lib/api";
import {
  getOwnedArchive,
  JOURNAL_MAX_LENGTH,
  parseAudioType,
  upsertJournal,
} from "@/lib/archives";

/** GET /api/archives/{id}/journal — { journal: Journal | null } */
export const GET = handler(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const row = await db.query.journals.findFirst({ where: eq(journals.archiveId, id) });
  return ok({ journal: row ?? null });
});

/**
 * PUT /api/archives/{id}/journal  { content, audioType }
 * Upsert — one journal per archive (JOURNAL-04). 201 on create, 200 on update.
 * Validation (TBD-07, decided for MVP): non-empty after trim, ≤ 2000 chars.
 */
export const PUT = handler(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await params;
  await getOwnedArchive(id, user.id);
  const body = await readJson<{ content?: unknown; audioType?: unknown }>(req);

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) throw new HttpError("VALIDATION_FAILED", "Journal 내용을 입력해 주세요.");
  if (content.length > JOURNAL_MAX_LENGTH)
    throw new HttpError("VALIDATION_FAILED", `Journal은 ${JOURNAL_MAX_LENGTH}자 이내로 작성해 주세요.`);

  const { journal, created } = await upsertJournal(id, {
    content,
    audioType: parseAudioType(body.audioType),
  });
  return ok({ journal, created }, created ? 201 : 200);
});
