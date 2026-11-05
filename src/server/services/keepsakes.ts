import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { KEEPSAKE_TEMPLATES, sentenceLimit, templateDefaults, type keepsakeUpsertInput } from "@still/shared/keepsake";
import { db } from "../db/client";
import { archives, digitalKeepsakes, journals, scraps } from "../db/schema";
import { issueTicket } from "../media/keepsake-ticket";
import { AppError } from "../trpc/init";
import { ensureArchive, findExhibition } from "./archives";
import { guidePage } from "./guide-pages";
import { completeExhibition } from "./visible";

type KeepsakeContent = { version: 1; sentences: { sentenceId: string; content: string }[]; journalExcerpt: string | null };

// The SPEC §7.3 representation, for one guide page: the card carries the page (its title and picture) with the
// exhibition's venue and dates, read live, never snapshotted.
function stillOrigin() {
  if (!process.env.STILL_ORIGIN) throw new Error("STILL_ORIGIN is not set");
  return process.env.STILL_ORIGIN;
}

export async function getKeepsake(userId: string, code: string, page: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
    with: { keepsakes: { where: eq(digitalKeepsakes.page, page) }, exhibition: { with: { venue: true } } },
  });
  const keepsake = archive?.keepsakes[0];
  if (!archive || !keepsake) return null;
  const live = completeExhibition(archive.exhibition);
  const shown = await guidePage(live.guide, page);
  const { sentences, journalExcerpt } = keepsake.contentData as KeepsakeContent;
  const { ticket, expiresAt } = issueTicket({ userId, archiveId: archive.id, page, updatedAt: keepsake.updatedAt.toISOString() });
  return {
    page,
    templateId: keepsake.templateId,
    card: {
      exhibition: { title: shown.title || live.title, venue: { name: live.venue.name, city: live.venue.city }, startDate: live.startDate, endDate: live.endDate },
      image: shown.image,
      sentences,
      journalExcerpt,
    },
    png: { url: `${stillOrigin()}/api/media/keepsake?ticket=${ticket}`, expiresAt: expiresAt.toISOString() },
    createdAt: keepsake.createdAt.toISOString(),
    updatedAt: keepsake.updatedAt.toISOString(),
  };
}

export async function upsertKeepsake(userId: string, { code, page, templateId, sentenceIds, journalExcerpt }: z.infer<typeof keepsakeUpsertInput>) {
  if (!(KEEPSAKE_TEMPLATES as readonly string[]).includes(templateId)) {
    throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("UNKNOWN_TEMPLATE") });
  }
  const shown = await guidePage((await findExhibition(code)).guide, page);
  if (!shown.found) throw new TRPCError({ code: "NOT_FOUND" });
  const created = await db.transaction(async (tx) => {
    const archive = await ensureArchive(userId, code, tx);
    // Only the lines kept on this page go on its card.
    const saved = (
      await tx
        .select({ sentenceId: scraps.guideSentenceId, content: scraps.sentenceContentSnapshot })
        .from(scraps)
        .where(eq(scraps.archiveId, archive.id))
        .orderBy(asc(scraps.createdAt), asc(scraps.guideSentenceId))
    ).filter((s) => shown.sentenceIds.has(s.sentenceId));
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
    const inserted = await tx.insert(digitalKeepsakes).values({ archiveId: archive.id, page, templateId, contentData: content }).onConflictDoNothing().returning();
    if (inserted.length > 0) return true;
    await tx
      .update(digitalKeepsakes)
      .set({ templateId, contentData: content, updatedAt: sql`now()` })
      .where(and(eq(digitalKeepsakes.archiveId, archive.id), eq(digitalKeepsakes.page, page)));
    return false;
  });
  const keepsake = await getKeepsake(userId, code, page);
  if (!keepsake) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return { keepsake, created };
}

// Idempotent: deleting a card that does not exist succeeds.
export async function deleteKeepsake(userId: string, code: string, page: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
  });
  if (archive) await db.delete(digitalKeepsakes).where(and(eq(digitalKeepsakes.archiveId, archive.id), eq(digitalKeepsakes.page, page)));
}

// Every card the visitor made in this exhibition, one per page, the latest first (Archive).
export async function listKeepsakes(userId: string, code: string) {
  const exhibition = await findExhibition(code);
  const archive = await db.query.archives.findFirst({
    where: and(eq(archives.userId, userId), eq(archives.exhibitionId, exhibition.id)),
    with: { keepsakes: { columns: { page: true }, orderBy: desc(digitalKeepsakes.updatedAt) } },
  });
  const pages = (archive?.keepsakes ?? []).map((k) => k.page).filter((page) => page !== "");
  const cards = await Promise.all(pages.map((page) => getKeepsake(userId, code, page)));
  return cards.filter((card) => card !== null);
}
