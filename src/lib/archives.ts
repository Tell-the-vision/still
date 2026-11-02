/**
 * Archive domain logic (server-only).
 *
 *  - getOrCreateArchive  → CORE-03 (one archive per user × exhibition)
 *  - upsertJournal       → CORE-04 (one journal per archive)
 *  - deleteArchive       → CORE-09 (cascade delete inside a transaction)
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  archives,
  digitalKeepsakes,
  guideSentences,
  journals,
  scraps,
  users,
  JOURNAL_AUDIO_TYPE,
  type Archive,
  type JournalAudioType,
} from "@/db/schema";
import { HttpError } from "./api";

export const JOURNAL_MAX_LENGTH = 2000; // TBD-07: decided for MVP

export async function getOrCreateArchive(userId: string, exhibitionId: string) {
  const now = new Date();
  const existing = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibitionId)),
  });
  if (existing) {
    const [updated] = await db
      .update(archives)
      .set({ lastVisitedAt: now })
      .where(eq(archives.id, existing.id))
      .returning();
    return { archive: updated, created: false };
  }
  try {
    const [created] = await db
      .insert(archives)
      .values({ userId, exhibitionId, firstVisitedAt: now, lastVisitedAt: now })
      .returning();
    return { archive: created, created: true };
  } catch (err) {
    // Concurrent create → unique index fires → return the winner.
    const again = await db.query.archives.findFirst({
      where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibitionId)),
    });
    if (again) return { archive: again, created: false };
    throw err;
  }
}

/** Archive the current user owns, or throw 404 / 403. */
export async function getOwnedArchive(archiveId: string, userId: string): Promise<Archive> {
  const row = await db.query.archives.findFirst({ where: eq(archives.id, archiveId) });
  if (!row) throw new HttpError("RESOURCE_NOT_FOUND", "Archive를 찾을 수 없습니다.");
  if (row.userId !== userId) throw new HttpError("FORBIDDEN", "이 Archive에 접근할 수 없습니다.");
  return row;
}

export async function listArchives(userId: string) {
  return db.query.archives.findMany({
    where: eq(archives.userId, userId),
    orderBy: [desc(archives.lastVisitedAt)],
    with: {
      exhibition: true,
      scraps: { columns: { id: true } },
      journal: { columns: { id: true, updatedAt: true } },
      keepsakes: { columns: { id: true } },
    },
  });
}

export async function getArchiveDetail(archiveId: string) {
  return db.query.archives.findFirst({
    where: eq(archives.id, archiveId),
    with: {
      exhibition: { with: { audioConfig: true } },
      scraps: { orderBy: [desc(scraps.createdAt)] },
      journal: true,
      keepsakes: { orderBy: [desc(digitalKeepsakes.createdAt)] },
    },
  });
}

export async function addScrap(archive: Archive, guideSentenceId: string) {
  const sentence = await db.query.guideSentences.findFirst({
    where: eq(guideSentences.id, guideSentenceId),
  });
  if (!sentence) throw new HttpError("RESOURCE_NOT_FOUND", "해설 문장을 찾을 수 없습니다.");
  if (sentence.exhibitionId !== archive.exhibitionId)
    throw new HttpError("VALIDATION_FAILED", "이 전시의 해설 문장이 아닙니다.");

  const existing = await db.query.scraps.findFirst({
    where: and(eq(scraps.archiveId, archive.id), eq(scraps.guideSentenceId, guideSentenceId)),
  });
  if (existing) return { scrap: existing, created: false };

  try {
    const [created] = await db
      .insert(scraps)
      .values({
        archiveId: archive.id,
        guideSentenceId,
        sentenceContentSnapshot: sentence.content,
      })
      .returning();
    return { scrap: created, created: true };
  } catch {
    const again = await db.query.scraps.findFirst({
      where: and(eq(scraps.archiveId, archive.id), eq(scraps.guideSentenceId, guideSentenceId)),
    });
    if (again) return { scrap: again, created: false };
    throw new HttpError("INTERNAL_ERROR", "문장을 저장하지 못했습니다.");
  }
}

export function parseAudioType(value: unknown): JournalAudioType {
  if (typeof value === "string" && (JOURNAL_AUDIO_TYPE as readonly string[]).includes(value))
    return value as JournalAudioType;
  return "NONE";
}

/** PUT /archives/{id}/journal — create or update the single journal. */
export async function upsertJournal(
  archiveId: string,
  input: { content: string; audioType: JournalAudioType },
) {
  const existing = await db.query.journals.findFirst({
    where: eq(journals.archiveId, archiveId),
  });
  if (existing) {
    const [updated] = await db
      .update(journals)
      .set({ content: input.content, audioType: input.audioType })
      .where(eq(journals.id, existing.id))
      .returning();
    return { journal: updated, created: false };
  }
  try {
    const [created] = await db
      .insert(journals)
      .values({ archiveId, content: input.content, audioType: input.audioType })
      .returning();
    return { journal: created, created: true };
  } catch {
    // Lost a race → unique(archive_id) fired → update the winner instead.
    const again = await db.query.journals.findFirst({ where: eq(journals.archiveId, archiveId) });
    if (!again) throw new HttpError("INTERNAL_ERROR", "Journal을 저장하지 못했습니다.");
    const [updated] = await db
      .update(journals)
      .set({ content: input.content, audioType: input.audioType })
      .where(eq(journals.id, again.id))
      .returning();
    return { journal: updated, created: false };
  }
}

/** Cascade delete: scraps → journal → keepsakes → archive, atomically. */
export async function deleteArchive(archiveId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(scraps).where(eq(scraps.archiveId, archiveId));
    await tx.delete(journals).where(eq(journals.archiveId, archiveId));
    await tx.delete(digitalKeepsakes).where(eq(digitalKeepsakes.archiveId, archiveId));
    await tx.delete(archives).where(eq(archives.id, archiveId));
  });
}

/** Account deletion (TBD-08: decided — everything goes). */
export async function deleteUserCompletely(userId: string) {
  await db.transaction(async (tx) => {
    const owned = await tx.query.archives.findMany({
      where: eq(archives.userId, userId),
      columns: { id: true },
    });
    for (const a of owned) {
      await tx.delete(scraps).where(eq(scraps.archiveId, a.id));
      await tx.delete(journals).where(eq(journals.archiveId, a.id));
      await tx.delete(digitalKeepsakes).where(eq(digitalKeepsakes.archiveId, a.id));
    }
    await tx.delete(archives).where(eq(archives.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
