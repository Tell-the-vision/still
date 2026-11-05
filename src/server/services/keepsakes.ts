import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { KEEPSAKE_TEMPLATES, sentenceLimit, templateDefaults, type keepsakeUpsertInput } from "@still/shared/keepsake";
import { db } from "../db/client";
import { archives, digitalKeepsakes, journals, scraps } from "../db/schema";
import { issueTicket } from "../media/keepsake-ticket";
import { publicImageUrl } from "../media/public-url";
import { AppError } from "../trpc/init";
import { ensureArchive, findExhibition } from "./archives";
import { completeExhibition, hasPublicCopy } from "./visible";

const pick = ({ altText, width, height }: { altText: string | null; width: number; height: number }) => ({ altText, width, height });

type KeepsakeContent = { version: 1; sentences: { sentenceId: string; content: string }[]; journalExcerpt: string | null };

// The SPEC §7.3 representation. The exhibition and cover are read live, never snapshotted.
function stillOrigin() {
  if (!process.env.STILL_ORIGIN) throw new Error("STILL_ORIGIN is not set");
  return process.env.STILL_ORIGIN;
}

export async function getKeepsake(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
    with: { keepsake: true, exhibition: { with: { venue: true, coverImage: true } } },
  });
  if (!archive?.keepsake) return null;
  const { keepsake } = archive;
  const live = completeExhibition(archive.exhibition);
  const { sentences, journalExcerpt } = keepsake.contentData as KeepsakeContent;
  const { ticket, expiresAt } = issueTicket({ userId, archiveId: archive.id, updatedAt: keepsake.updatedAt.toISOString() });
  return {
    templateId: keepsake.templateId,
    card: {
      exhibition: { title: live.title, venue: { name: live.venue.name, city: live.venue.city }, startDate: live.startDate, endDate: live.endDate },
      image: hasPublicCopy(live.coverImage) ? { url: publicImageUrl(live.coverImage.objectKey), ...pick(live.coverImage) } : null,
      sentences,
      journalExcerpt,
    },
    png: { url: `${stillOrigin()}/api/media/keepsake?ticket=${ticket}`, expiresAt: expiresAt.toISOString() },
    createdAt: keepsake.createdAt.toISOString(),
    updatedAt: keepsake.updatedAt.toISOString(),
  };
}

export async function upsertKeepsake(userId: string, { code, templateId, sentenceIds, journalExcerpt }: z.infer<typeof keepsakeUpsertInput>) {
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
    // Picked sentences come from the saved snapshot, in the order the user picked,
    // and only as many as the template shows, so nothing is stored that the card leaves out.
    const picked = sentenceIds
      ?.map((id) => {
        const scrap = saved.find((s) => s.sentenceId === id);
        if (!scrap) throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("SCRAP_NOT_IN_ARCHIVE") });
        return scrap;
      })
      .slice(0, sentenceLimit(templateId));
    // An explicit excerpt must appear in the saved journal, compared after NFC normalization on both sides.
    if (journalExcerpt !== undefined && !journal?.content.normalize("NFC").includes(journalExcerpt.normalize("NFC"))) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("EXCERPT_NOT_IN_JOURNAL") });
    }
    const content: KeepsakeContent = {
      version: 1,
      sentences: picked ?? defaults.sentences,
      journalExcerpt: journalExcerpt?.normalize("NFC") ?? defaults.journalExcerpt,
    };
    const inserted = await tx.insert(digitalKeepsakes).values({ archiveId: archive.id, templateId, contentData: content }).onConflictDoNothing().returning();
    if (inserted.length > 0) return true;
    await tx.update(digitalKeepsakes).set({ templateId, contentData: content, updatedAt: sql`now()` }).where(eq(digitalKeepsakes.archiveId, archive.id));
    return false;
  });
  const keepsake = await getKeepsake(userId, code);
  if (!keepsake) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return { keepsake, created };
}

// Idempotent: deleting a card that does not exist succeeds.
export async function deleteKeepsake(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
  });
  if (archive) await db.delete(digitalKeepsakes).where(eq(digitalKeepsakes.archiveId, archive.id));
}
