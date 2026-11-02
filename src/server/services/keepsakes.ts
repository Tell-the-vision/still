import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { KEEPSAKE_TEMPLATES, templateDefaults, type keepsakeUpsertInput } from "@still/shared/keepsake";
import { db } from "../db/client";
import { archives, digitalKeepsakes, journals, scraps } from "../db/schema";
import { publicImageUrl } from "../media/public-url";
import { AppError } from "../trpc/init";
import { ensureArchive, findExhibition } from "./archives";

const pick = ({ altText, width, height }: { altText: string | null; width: number; height: number }) => ({ altText, width, height });

type KeepsakeContent = { version: 1; sentences: { sentenceId: string; content: string }[]; journalExcerpt: string | null };

// The SPEC §7.3 representation. The exhibition and cover are read live, never snapshotted.
export async function getKeepsake(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
    with: { keepsake: true, exhibition: { with: { venue: true, coverImage: true } } },
  });
  if (!archive?.keepsake) return null;
  const { keepsake, exhibition: live } = archive;
  const { sentences, journalExcerpt } = keepsake.contentData as KeepsakeContent;
  return {
    templateId: keepsake.templateId,
    card: {
      exhibition: { title: live.title, venue: { name: live.venue.name, city: live.venue.city }, startDate: live.startDate, endDate: live.endDate },
      image: live.coverImage && { url: publicImageUrl(live.coverImage.objectKey), ...pick(live.coverImage) },
      sentences,
      journalExcerpt,
    },
    png: null,
    createdAt: keepsake.createdAt.toISOString(),
    updatedAt: keepsake.updatedAt.toISOString(),
  };
}

export async function upsertKeepsake(userId: string, { code, templateId, sentenceIds }: z.infer<typeof keepsakeUpsertInput>) {
  if (!(KEEPSAKE_TEMPLATES as readonly string[]).includes(templateId)) {
    throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("UNKNOWN_TEMPLATE") });
  }
  const created = await db.transaction(async (tx) => {
    const archive = await ensureArchive(userId, code, tx);
    const saved = await tx
      .select({ sentenceId: scraps.guideSentenceId, content: scraps.sentenceContentSnapshot })
      .from(scraps)
      .where(eq(scraps.archiveId, archive.id))
      .orderBy(asc(scraps.createdAt), asc(scraps.guideSentenceId));
    const journal = await tx.query.journals.findFirst({ where: eq(journals.archiveId, archive.id) });
    const defaults = templateDefaults(templateId, saved, journal?.content ?? null);
    // Picked sentences come from the saved snapshot, in the order the user picked.
    const picked = sentenceIds?.map((id) => {
      const scrap = saved.find((s) => s.sentenceId === id);
      if (!scrap) throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("SCRAP_NOT_IN_ARCHIVE") });
      return scrap;
    });
    const content: KeepsakeContent = { version: 1, sentences: picked ?? defaults.sentences, journalExcerpt: defaults.journalExcerpt };
    const inserted = await tx.insert(digitalKeepsakes).values({ archiveId: archive.id, templateId, contentData: content }).onConflictDoNothing().returning();
    if (inserted.length > 0) return true;
    await tx.update(digitalKeepsakes).set({ templateId, contentData: content, updatedAt: sql`now()` }).where(eq(digitalKeepsakes.archiveId, archive.id));
    return false;
  });
  const keepsake = await getKeepsake(userId, code);
  if (!keepsake) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return { keepsake, created };
}
