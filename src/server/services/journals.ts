import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { journalContent, journalUpsertInput } from "@still/shared/journal";
import { db } from "../db/client";
import { journals } from "../db/schema";
import { AppError } from "../trpc/init";
import { ensureArchive, findExhibition } from "./archives";

// The SPEC §5 representation.
function toJournal(row: typeof journals.$inferSelect) {
  const { content, revision } = row;
  const audioType = journalUpsertInput.shape.audioType.parse(row.audioType);
  return { content, audioType, revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function getJournal(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, userId), eq(a.exhibitionId, exhibition.id)),
    with: { journal: true },
  });
  return archive?.journal ? toJournal(archive.journal) : null;
}

export async function upsertJournal(userId: string, input: z.infer<typeof journalUpsertInput>) {
  if (!journalContent.safeParse(input.content).success) {
    throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("JOURNAL_INVALID") });
  }
  const { content, audioType, revision } = input;
  return db.transaction(async (tx) => {
    const archive = await ensureArchive(userId, input.code, tx);
    const [row] =
      revision === null
        ? await tx.insert(journals).values({ archiveId: archive.id, content, audioType }).onConflictDoNothing().returning()
        : await tx
            .update(journals)
            .set({ content, audioType, revision: sql`gen_random_uuid()`, updatedAt: sql`now()` })
            .where(and(eq(journals.archiveId, archive.id), eq(journals.revision, revision)))
            .returning();
    if (!row) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    return { journal: toJournal(row), created: revision === null };
  });
}

// Idempotent: no archive or no journal means nothing to delete.
export async function deleteJournal(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, userId), eq(a.exhibitionId, exhibition.id)),
  });
  if (archive) await db.delete(journals).where(eq(journals.archiveId, archive.id));
}
