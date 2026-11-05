import type { ContentBlock } from "../../../../shared/src/console-content";
import { scrapRuns, stillDocument, type StillDocument } from "../../../../shared/src/still-doc";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { contents, exhibitionPlaylists, exhibitions, guideSentences, images } from "../../db/schema";
import { copyPrivateToPublic } from "../../media/r2";
import { AppError } from "../../trpc/init";
import { compileDraft, withScrapIds } from "./compile";
import { getBoss } from "./analysis-jobs";
import { enqueueStorageDeletes } from "./storage-jobs";
import { exhibitionRows } from "./exhibition-rows";
import { loadDraft, publicationChecks, type LoadedDraft } from "./preview";

// Publication and unpublishing (SPEC §10.9 발행 쓰기 경로, 발행 취소).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ImageRow = typeof images.$inferSelect;

const preconditionFailed = (appCode: ConstructorParameters<typeof AppError>[0], message?: string) =>
  new TRPCError({ code: "PRECONDITION_FAILED", message, cause: new AppError(appCode) });

// The checks that block publication, as one sentence naming each of them (warnings do not block).
function assertChecksPass(code: string, loaded: LoadedDraft) {
  const failed = publicationChecks(code, loaded).filter((check) => !check.ok);
  if (failed.length === 0) return;
  throw preconditionFailed("PUBLISH_CHECKS_FAILED", `These checks do not pass: ${failed.map((c) => `${c.title} (${c.detail})`).join("; ")}.`);
}

// The images the visitor will see: those in the documents and the cover.
const usedImageIds = ({ draft, compiled }: LoadedDraft) => new Set([...compiled.imageIds, ...(draft.coverImageId ? [draft.coverImageId] : [])]);

// Step 2: an image without a public file gets its display file copied from the private bucket, outside
// the transaction (a leftover object after a failed transaction is for the cleanup job). Returns the
// object keys to store. The "Image files" check refuses such images until the extraction module (#65)
// writes manifests, so this does nothing yet.
async function copyDisplayFiles(loaded: LoadedDraft): Promise<Map<string, string>> {
  const used = usedImageIds(loaded);
  const keys = new Map<string, string>();
  for (const image of loaded.imageRows.filter((i) => used.has(i.id) && i.objectKey === null)) {
    const publicKey = `${image.id}.webp`;
    await copyPrivateToPublic(displayKeyOf(image), publicKey);
    keys.set(image.id, publicKey);
  }
  return keys;
}

// The private-bucket key of an image's manifest `display` file. No manifest exists before #65.
function displayKeyOf(image: ImageRow): string {
  throw new Error(`Image ${image.id} has no manifest display file`);
}

// Gives every compiled sentence a guide_sentences row and writes the row's id into the content block
// (or the scrap mark of `contents.doc`); the content's `revision` stays: this is not an edit.
// Returns the contents as rewritten.
async function storeSentences(tx: Tx, exhibitionId: string, loaded: LoadedDraft) {
  const rows = new Map(loaded.contentRows.map((c) => [c.id, c]));
  const docIds = new Map<string, Map<number, string>>();
  for (const sentence of loaded.compiled.sentences) {
    const [existing] = sentence.guideSentenceId
      ? await tx
          .update(guideSentences)
          .set({ content: sentence.text, deletedAt: null })
          .where(and(eq(guideSentences.id, sentence.guideSentenceId), eq(guideSentences.exhibitionId, exhibitionId)))
          .returning({ id: guideSentences.id })
      : [];
    if (existing) continue;

    const [created] = await tx.insert(guideSentences).values({ exhibitionId, content: sentence.text }).returning({ id: guideSentences.id });
    const content = rows.get(sentence.contentId)!;
    if (sentence.docRun !== undefined) {
      docIds.set(content.id, (docIds.get(content.id) ?? new Map()).set(sentence.docRun, created.id));
    } else {
      const blocks = content.blocks.map((b): ContentBlock => (b.id === sentence.blockId && b.type === "sentence" ? { ...b, guideSentenceId: created.id } : b));
      rows.set(content.id, { ...content, blocks });
      await tx.update(contents).set({ blocks }).where(eq(contents.id, content.id));
    }
  }
  for (const [contentId, ids] of docIds) {
    const doc = withScrapIds(rows.get(contentId)!.doc, ids);
    rows.set(contentId, { ...rows.get(contentId)!, doc });
    await tx.update(contents).set({ doc }).where(eq(contents.id, contentId));
  }
  return loaded.contentRows.map((c) => rows.get(c.id)!);
}

// Before commit: the live sentences are exactly the ones the stored guide references, each once.
async function assertGuideMatchesSentences(tx: Tx, exhibitionId: string, guide: StillDocument | null) {
  const live = await tx.select({ id: guideSentences.id, content: guideSentences.content }).from(guideSentences).where(and(eq(guideSentences.exhibitionId, exhibitionId), isNull(guideSentences.deletedAt)));
  const runs = guide ? scrapRuns(guide) : [];
  const once = new Set(runs.map((r) => r.sentenceId)).size === runs.length;
  const sameText = live.every((s) => runs.find((r) => r.sentenceId === s.id)?.text === s.content);
  if (!once || runs.length !== live.length || !sameText) throw new Error("The stored guide and the live sentences differ");
}

export async function publishExhibition(input: { institutionId: string; userId: string; code: string; revision: string; rightsConfirmed: boolean; rightsStatementVersion: string }) {
  const { institutionId, userId, code, revision, rightsStatementVersion } = input;
  const [row] = await exhibitionRows(institutionId, { where: eq(exhibitions.code, code) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });

  // 1. The revision the institution previewed, the rights confirmation and the checks.
  if (row.draftRevision !== revision) throw preconditionFailed("REVISION_MISMATCH");
  if (!input.rightsConfirmed) throw preconditionFailed("RIGHTS_NOT_CONFIRMED", "Confirm that the museum has permission to publish the content.");
  assertChecksPass(code, await loadDraft(db, row.id));

  // 2. Public copies of images that have none.
  const copiedKeys = await copyDisplayFiles(await loadDraft(db, row.id));

  // 3. One transaction. The exhibition row lock holds off draft writes; the contents' locks hold off reviews.
  const boss = await getBoss();
  await db.transaction(async (tx) => {
    const [locked] = await tx.select({ draftRevision: exhibitions.draftRevision }).from(exhibitions).where(eq(exhibitions.id, row.id)).for("update");
    if (locked.draftRevision !== revision) throw preconditionFailed("REVISION_MISMATCH");
    const loaded = await loadDraft(tx, row.id, { lockContents: true });
    assertChecksPass(code, loaded);
    const { draft } = loaded;

    for (const [imageId, objectKey] of copiedKeys) await tx.update(images).set({ objectKey }).where(eq(images.id, imageId));

    // The documents are compiled again with the stored sentence ids, so no placeholder id is stored.
    const compiled = compileDraft(draft, await storeSentences(tx, row.id, loaded), loaded.imageRows);
    const stored = {
      description: stillDocument.nullable().parse(compiled.description),
      guide: stillDocument.nullable().parse(compiled.guide),
    };
    const sentenceIds = compiled.sentences.map((s) => s.guideSentenceId!);
    await tx
      .update(guideSentences)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(guideSentences.exhibitionId, row.id), isNull(guideSentences.deletedAt), sentenceIds.length ? notInArray(guideSentences.id, sentenceIds) : undefined));
    await assertGuideMatchesSentences(tx, row.id, stored.guide);

    // A published image that neither document nor cover uses goes back to having no public file (its row stays).
    const used = usedImageIds({ ...loaded, compiled });
    const unused = loaded.imageRows.filter((i) => i.objectKey !== null && !used.has(i.id));
    if (unused.length) await tx.update(images).set({ objectKey: null }).where(inArray(images.id, unused.map((i) => i.id)));

    await tx
      .update(exhibitions)
      .set({
        title: draft.title,
        subtitle: draft.subtitle,
        venueId: draft.venueId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        ambienceEnabled: draft.ambienceEnabled,
        coverImageId: draft.coverImageId,
        description: stored.description,
        guide: stored.guide,
        state: "PUBLISHED",
        firstPublishedAt: sql`coalesce(${exhibitions.firstPublishedAt}, now())`,
        publishedRevision: locked.draftRevision,
        publishedAt: sql`now()`,
        publishedBy: userId,
        rightsStatementVersion,
      })
      .where(eq(exhibitions.id, row.id));

    if (draft.playlist) {
      await tx.insert(exhibitionPlaylists).values({ exhibitionId: row.id, ...draft.playlist }).onConflictDoUpdate({ target: exhibitionPlaylists.exhibitionId, set: draft.playlist });
    } else {
      await tx.delete(exhibitionPlaylists).where(eq(exhibitionPlaylists.exhibitionId, row.id));
    }
    await enqueueStorageDeletes(boss, tx, unused.map((i) => ({ bucket: "public", key: i.objectKey! })));
  });

  // The CDN purge after commit (미결정 35) does not exist yet.
}

// PUBLISHED -> UNPUBLISHED. The public columns and guide_sentences stay, so republishing continues the
// same sentence ids. Any other state is a plain CONFLICT (there is no app code for it in SPEC §11.2).
// The CDN purge after commit is 미결정 35 and is not done.
export async function unpublishExhibition(institutionId: string, code: string) {
  await db.transaction(async (tx) => {
    const [exhibition] = await tx
      .select({ id: exhibitions.id, state: exhibitions.state })
      .from(exhibitions)
      .where(and(eq(exhibitions.institutionId, institutionId), eq(exhibitions.code, code)))
      .for("update");
    if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
    if (exhibition.state !== "PUBLISHED") throw new TRPCError({ code: "CONFLICT", message: "The exhibition is not published." });
    await tx.update(exhibitions).set({ state: "UNPUBLISHED" }).where(eq(exhibitions.id, exhibition.id));
  });
}
