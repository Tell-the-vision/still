import { consoleDraftGetInput, consoleDraftUpdateInput } from "@still/shared/console";
import type { ExhibitionDraft } from "@still/shared/console-draft";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { contents, exhibitions, images, venues } from "../../../db/schema";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { AppError, consoleProcedure, router } from "../../init";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const refuse = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

// The rules that span rows, which the draft's own schema cannot see (SPEC §10.9): the venue exists, the
// cover is one of this exhibition's images, and the guide lists approved contents of this exhibition once.
async function assertDraftReferences(tx: Tx, exhibitionId: string, draft: ExhibitionDraft) {
  if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) throw refuse("The start date must not be after the end date.");

  if (draft.venueId) {
    const [venue] = await tx.select({ id: venues.id }).from(venues).where(eq(venues.id, draft.venueId));
    if (!venue) throw refuse("The venue does not exist.");
  }

  if (draft.coverImageId) {
    const [cover] = await tx
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.id, draft.coverImageId), eq(images.exhibitionId, exhibitionId)));
    if (!cover) throw refuse("The cover image is not an image of this exhibition.");
  }

  if (draft.sections.filter((s) => s.kind === "INTRODUCTION").length > 1) throw refuse("A guide has at most one introduction section.");

  const contentIds = draft.sections.flatMap((s) => s.contentIds);
  if (new Set(contentIds).size !== contentIds.length) throw refuse("A content can appear only once in the guide, in one section.");
  if (contentIds.length > 0) {
    const own = await tx
      .select({ id: contents.id, status: contents.status })
      .from(contents)
      .where(and(inArray(contents.id, contentIds), eq(contents.exhibitionId, exhibitionId)))
      .for("share"); // a content being rejected at the same moment waits for this write
    if (own.length !== contentIds.length) throw refuse("A content in the guide is not a content of this exhibition.");
    if (own.some((c) => c.status !== "APPROVED")) throw refuse("Only approved contents can be in the guide.");
  }
}

// console.draft.* (SPEC §10.9 exhibitions.draft, Figma A5, A7). The draft is the institution's working
// copy: writes name the revision they were read at, and publishing (a later step) copies it.
export const consoleDraftRouter = router({
  get: consoleProcedure.input(consoleDraftGetInput).query(async ({ ctx, input }) => {
    const [row] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [{ draft }] = await db.select({ draft: exhibitions.draft }).from(exhibitions).where(eq(exhibitions.id, row.id));
    return { draft: draft as ExhibitionDraft, revision: row.draftRevision };
  }),

  // One conditional UPDATE takes the row lock and checks the revision (SPEC §11.1); the cross-row rules
  // are then checked inside the same transaction, so a refused draft is rolled back whole.
  update: consoleProcedure.input(consoleDraftUpdateInput).mutation(async ({ ctx, input }) => {
    const [row] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(exhibitions)
        .set({ draft: input.draft, draftRevision: sql`gen_random_uuid()` })
        .where(and(eq(exhibitions.id, row.id), eq(exhibitions.draftRevision, input.revision)))
        .returning({ revision: exhibitions.draftRevision });
      if (!updated) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
      await assertDraftReferences(tx, row.id, input.draft);
      return { draft: input.draft, revision: updated.revision };
    });
  }),
});
