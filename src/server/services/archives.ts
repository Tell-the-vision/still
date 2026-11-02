import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { archiveCursor, type archiveListInput } from "../../../shared/src/archive";
import { db } from "../db/client";
import { archives, exhibitions } from "../db/schema";
import { publicImageUrl } from "../media/public-url";

// A transaction or the plain client: child writes pass `tx` so a rejected write rolls back its archive.
type Executor = Pick<typeof db, "query" | "insert" | "update">;

export const archiveWith = {
  exhibition: { with: { venue: true, coverImage: true } },
  scraps: { columns: { guideSentenceId: true } },
  journal: { columns: { archiveId: true } },
  keepsake: { columns: { archiveId: true } },
} as const;

function findArchive(userId: string, exhibitionId: string, executor: Executor) {
  return executor.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibitionId)),
    with: archiveWith,
  });
}

type ArchiveRow = NonNullable<Awaited<ReturnType<typeof findArchive>>>;

// The SPEC §8.3 representation.
export function toArchive(row: ArchiveRow) {
  const { exhibition } = row;
  return {
    exhibition: {
      code: exhibition.code,
      title: exhibition.title,
      venue: { name: exhibition.venue.name, city: exhibition.venue.city },
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      coverImage: exhibition.coverImage && { url: publicImageUrl(exhibition.coverImage.objectKey) },
    },
    scrapCount: row.scraps.length,
    hasJournal: row.journal !== null,
    hasKeepsake: row.keepsake !== null,
    lastVisitedAt: row.lastVisitedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// Any status: personal data outlives unpublishing (SPEC §11.1).
export async function findExhibition(code: string, executor: Executor = db) {
  const exhibition = await executor.query.exhibitions.findFirst({ where: eq(exhibitions.code, code) });
  if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
  return exhibition;
}

const insertArchive = (userId: string, exhibitionId: string, executor: Executor) =>
  executor.insert(archives).values({ userId, exhibitionId }).onConflictDoNothing({ target: [archives.userId, archives.exhibitionId] }).returning();

// Opening a guide: creates the archive, or refreshes its last visit.
export async function upsertArchive(userId: string, code: string) {
  return db.transaction(async (tx) => {
    const exhibition = await findExhibition(code, tx);
    if (exhibition.status !== "PUBLISHED") throw new TRPCError({ code: "NOT_FOUND" });
    const visit = and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id));
    const created = (await insertArchive(userId, exhibition.id, tx)).length > 0;
    if (!created) await tx.update(archives).set({ lastVisitedAt: sql`now()` }).where(visit);
    const archive = await findArchive(userId, exhibition.id, tx);
    if (!archive) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return { archive: toArchive(archive), created };
  });
}

// For child writes (scrap, journal, keepsake): never touches last_visited_at (SPEC §8.1).
export async function ensureArchive(userId: string, code: string, executor: Executor = db) {
  const exhibition = await findExhibition(code, executor);
  if (!(await findArchive(userId, exhibition.id, executor))) {
    if (exhibition.status !== "PUBLISHED") throw new TRPCError({ code: "NOT_FOUND" });
    await insertArchive(userId, exhibition.id, executor);
  }
  const archive = await findArchive(userId, exhibition.id, executor);
  if (!archive) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return { id: archive.id, exhibitionId: exhibition.id };
}

function parseCursor(cursor: string) {
  try {
    return archiveCursor.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
  }
}

// Most recently visited first (SPEC §11.1); fetches one extra row to know whether a next page exists.
export async function listArchives(userId: string, { limit, cursor }: z.infer<typeof archiveListInput>) {
  const after = cursor ? parseCursor(cursor) : undefined;
  const rows = await db.query.archives.findMany({
    where: and(
      eq(archives.userId, userId),
      after && sql`(${archives.lastVisitedAt}, ${archives.id}) < (${after.lastVisitedAt}::timestamptz, ${after.id}::uuid)`,
    ),
    orderBy: [desc(archives.lastVisitedAt), desc(archives.id)],
    limit: limit + 1,
    with: archiveWith,
  });
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(JSON.stringify({ lastVisitedAt: last.lastVisitedAt.toISOString(), id: last.id })).toString("base64url")
      : null;
  const totalSize = await db.$count(archives, eq(archives.userId, userId));
  return { items: page.map(toArchive), nextCursor, totalSize };
}
