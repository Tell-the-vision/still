import { contentBlocks, type ContentBlock } from "@still/shared/console-content";
import { exhibitionDraft } from "@still/shared/console-draft";
import { and, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import { contents, exhibitions, images } from "../../db/schema";
import { AppError } from "../../trpc/init";

// Writes to contents (SPEC §10.8 상태 전이 and 쓰기 경로). An item of another institution is NOT_FOUND.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = typeof contents.$inferSelect;
export type ContentEdit = {
  kind?: Row["kind"];
  blocks?: ContentBlock[];
  fields?: Record<string, unknown> | null;
  editorialNote?: string | null;
};

const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
const notFound = () => new TRPCError({ code: "NOT_FOUND" });

// The refs of one block, or of one fields entry ({ value, origin, refs }).
const refsOf = (block: ContentBlock) => (block.type === "image" ? block.captionRefs : block.refs);
const fieldRefs = (field: unknown): string[] =>
  field && typeof field === "object" && "refs" in field && Array.isArray(field.refs) ? field.refs.map(String) : [];

// Refs must exist in a manifest of the exhibition's documents (SPEC §10.8), and no manifest exists yet.
// So the only refs accepted are the ones the item already carries on the same block id / field name:
// they were validated when analysis wrote them and a write cannot add one.
function assertNoNewRefs(refs: string[], existing: string[], where: string) {
  const unknown = refs.filter((ref) => !existing.includes(ref));
  if (unknown.length) throw badRequest(`${where} references ${unknown.join(", ")}, which is not in the exhibition's documents`);
}

// Blocks as they are stored: ids unique, images from this exhibition, refs not new, and a text block whose text
// changed (or is new) is EDITED, whatever origin the caller sent.
async function checkedBlocks(tx: Tx, exhibitionId: string, blocks: ContentBlock[], existing: ContentBlock[]): Promise<ContentBlock[]> {
  if (new Set(blocks.map((b) => b.id)).size !== blocks.length) throw badRequest("block ids must be unique");
  const imageIds = [...new Set(blocks.flatMap((b) => (b.type === "image" ? [b.imageId] : [])))];
  if (imageIds.length) {
    const own = await tx.select({ id: images.id }).from(images).where(and(eq(images.exhibitionId, exhibitionId), inArray(images.id, imageIds)));
    if (own.length !== imageIds.length) throw badRequest("imageId is not an image of this exhibition");
  }
  return blocks.map((block) => {
    const before = existing.find((b) => b.id === block.id);
    assertNoNewRefs(refsOf(block), before ? refsOf(before) : [], `block ${block.id}`);
    if (block.type === "image") return block;
    const unchanged = before && before.type === block.type && "text" in before && before.text === block.text;
    return { ...block, origin: unchanged && "origin" in before ? before.origin : "EDITED" };
  });
}

// fields entries whose value changed become EDITED; refs follow the same rule as blocks.
function checkedFields(fields: Record<string, unknown>, existing: unknown): Record<string, unknown> {
  const before = (existing && typeof existing === "object" ? existing : {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => {
      assertNoNewRefs(fieldRefs(field), fieldRefs(before[name]), `field ${name}`);
      const value = (f: unknown) => (f && typeof f === "object" && "value" in f ? f.value : undefined);
      const same = JSON.stringify(value(field)) === JSON.stringify(value(before[name]));
      return [name, field && typeof field === "object" ? { ...field, origin: same && before[name] ? (before[name] as { origin?: unknown }).origin : "EDITED" } : field];
    }),
  );
}

// Removes `contentIds` from the draft's sections in the same transaction (SPEC §10.8 REJECTED, delete). The
// exhibition row is locked first by the caller. A draft that lists none of them is left alone.
async function removeFromDraftSections(tx: Tx, exhibitionId: string, contentIds: string[]) {
  const [row] = await tx.select({ draft: exhibitions.draft }).from(exhibitions).where(eq(exhibitions.id, exhibitionId));
  const draft = exhibitionDraft.parse(row.draft);
  if (!draft.sections.some((s) => s.contentIds.some((id) => contentIds.includes(id)))) return;
  const sections = draft.sections.map((s) => ({ ...s, contentIds: s.contentIds.filter((id) => !contentIds.includes(id)) }));
  await tx
    .update(exhibitions)
    .set({ draft: { ...draft, sections }, draftRevision: sql`gen_random_uuid()`, updatedAt: sql`now()` })
    .where(eq(exhibitions.id, exhibitionId));
}

// Locks the exhibition of the caller's item. NOT_FOUND for anything else.
async function lockOwnedContent(tx: Tx, institutionId: string, id: string): Promise<Row> {
  const [owned] = await tx
    .select({ exhibitionId: contents.exhibitionId })
    .from(contents)
    .innerJoin(exhibitions, eq(exhibitions.id, contents.exhibitionId))
    .where(and(eq(contents.id, id), eq(exhibitions.institutionId, institutionId)));
  if (!owned) throw notFound();
  await tx.select({ id: exhibitions.id }).from(exhibitions).where(eq(exhibitions.id, owned.exhibitionId)).for("update");
  const [row] = await tx.select().from(contents).where(eq(contents.id, id));
  if (!row) throw notFound();
  return row;
}

export async function createContent(exhibitionId: string, input: ContentEdit & { kind: Row["kind"]; blocks: ContentBlock[] }) {
  return db.transaction(async (tx) => {
    // A manual item has no source text: every text block is the institution's own (EDITED).
    const blocks = await checkedBlocks(tx, exhibitionId, input.blocks, []);
    const [row] = await tx
      .insert(contents)
      .values({ exhibitionId, kind: input.kind, status: "READY", blocks, fields: input.fields ? checkedFields(input.fields, null) : null, editorialNote: input.editorialNote ?? null })
      .returning({ id: contents.id });
    return row.id;
  });
}

// One conditional UPDATE … WHERE id = $i AND revision = $r. A REJECTED item is terminal: CONFLICT.
export async function updateContent(
  { institutionId, userId }: { institutionId: string; userId: string },
  input: ContentEdit & { id: string; revision: string; status?: "APPROVED" | "REJECTED" },
) {
  return db.transaction(async (tx) => {
    const row = await lockOwnedContent(tx, institutionId, input.id);
    if (row.revision !== input.revision) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    if (row.status === "REJECTED") throw new TRPCError({ code: "CONFLICT", message: "A rejected item cannot change; create a new one." });
    if (input.status === "APPROVED" && row.status === "APPROVED") throw new TRPCError({ code: "CONFLICT", message: "The item is already approved." });

    const edits: Partial<typeof contents.$inferInsert> = {};
    if (input.kind !== undefined) edits.kind = input.kind;
    if (input.blocks !== undefined) edits.blocks = await checkedBlocks(tx, row.exhibitionId, input.blocks, contentBlocks.parse(row.blocks));
    if (input.fields !== undefined) edits.fields = input.fields && checkedFields(input.fields, row.fields);
    if (input.editorialNote !== undefined) edits.editorialNote = input.editorialNote;
    // Block, field and kind edits send an APPROVED item back to READY (the editorial note does not).
    const contentEdited = input.kind !== undefined || input.blocks !== undefined || input.fields !== undefined;
    const status = input.status ?? (contentEdited && row.status === "APPROVED" ? "READY" : row.status);
    const approved = status === "APPROVED";
    const stays = approved && row.status === "APPROVED";

    const updated = await tx
      .update(contents)
      .set({
        ...edits,
        status,
        approvedAt: stays ? row.approvedAt : approved ? sql`now()` : null,
        approvedBy: stays ? row.approvedBy : approved ? userId : null,
        revision: sql`gen_random_uuid()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(contents.id, input.id), eq(contents.revision, input.revision)))
      .returning({ id: contents.id });
    if (!updated.length) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    if (status === "REJECTED") await removeFromDraftSections(tx, row.exhibitionId, [row.id]);
    return row.exhibitionId;
  });
}

export async function deleteContent(institutionId: string, id: string) {
  await db.transaction(async (tx) => {
    const row = await lockOwnedContent(tx, institutionId, id);
    await removeFromDraftSections(tx, row.exhibitionId, [id]);
    await tx.delete(contents).where(eq(contents.id, id));
  });
}

// "Approve all ready" (SPEC §10.8): only READY, never NEEDS_REVIEW. Returns the ids it approved.
export async function approveReadyContents(exhibitionId: string, userId: string): Promise<string[]> {
  const rows = await db
    .update(contents)
    .set({ status: "APPROVED", approvedAt: sql`now()`, approvedBy: userId, revision: sql`gen_random_uuid()`, updatedAt: sql`now()` })
    .where(and(eq(contents.exhibitionId, exhibitionId), eq(contents.status, "READY")))
    .returning({ id: contents.id });
  return rows.map((r) => r.id);
}
