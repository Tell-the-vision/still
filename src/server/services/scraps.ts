import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { archives, guideSentences, scraps } from "../db/schema";
import { ensureArchive, findExhibition } from "./archives";

export async function listScraps(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const rows = await db
    .select({ sentenceId: scraps.guideSentenceId, content: scraps.sentenceContentSnapshot, createdAt: scraps.createdAt })
    .from(scraps)
    .innerJoin(archives, eq(archives.id, scraps.archiveId))
    .where(and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)))
    .orderBy(asc(scraps.createdAt), asc(scraps.guideSentenceId));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

// Saves a snapshot of the sentence's current text; saving twice is a no-op (SPEC §4.1).
export async function upsertScrap(userId: string, code: string, sentenceId: string) {
  return db.transaction(async (tx) => {
    const archive = await ensureArchive(userId, code, tx);
    const inserted = await tx
      .insert(scraps)
      .select(
        tx
          .select({
            archiveId: sql`${archive.id}::uuid`.as("archive_id"),
            exhibitionId: guideSentences.exhibitionId,
            guideSentenceId: guideSentences.id,
            sentenceContentSnapshot: guideSentences.content,
            createdAt: sql`now()`.as("created_at"),
          })
          .from(guideSentences)
          .where(and(eq(guideSentences.id, sentenceId), eq(guideSentences.exhibitionId, archive.exhibitionId), isNull(guideSentences.deletedAt))),
      )
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) return { created: true };
    const existing = await tx.query.scraps.findFirst({
      where: and(eq(scraps.archiveId, archive.id), eq(scraps.guideSentenceId, sentenceId)),
    });
    // Throwing rolls back an archive created just for this write.
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    return { created: false };
  });
}
