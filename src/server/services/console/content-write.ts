import { SOURCE_REF } from "@still/shared/manifest";
import { contentSources, countNodes, EMPTY_DOC, MAX_NODES, scrapRuns, stillDoc, type ContentSources, type StillDoc } from "@still/shared/still-doc";
import { z } from "zod";
import { exhibitionDraft } from "@still/shared/console-draft";
import { and, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import { contents, documents, exhibitions, images } from "../../db/schema";
import { AppError } from "../../trpc/init";

// Writes to contents (SPEC §10.8 상태 전이 and 쓰기 경로). An item of another institution is NOT_FOUND.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = typeof contents.$inferSelect;
export type ContentEdit = {
  kind?: Row["kind"];
  doc?: StillDoc;
  sources?: ContentSources;
  fields?: Record<string, unknown> | null;
  editorialNote?: string | null;
};

const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
const notFound = () => new TRPCError({ code: "NOT_FOUND" });

const fieldRefs = (field: unknown): string[] =>
  field && typeof field === "object" && "refs" in field && Array.isArray(field.refs) ? field.refs.map(String) : [];

// Refs must exist in a manifest of the exhibition's documents (SPEC §10.8), and no manifest exists yet.
// So the only refs accepted are the ones the item already carries on the same field name: they were
// validated when analysis wrote them and a write cannot add one.
function assertNoNewRefs(refs: string[], existing: string[], where: string) {
  const unknown = refs.filter((ref) => !existing.includes(ref));
  if (unknown.length) throw badRequest(`${where} references ${unknown.join(", ")}, which is not in the exhibition's documents`);
}

// A doc as it is stored (SPEC §10.8 저장 시 검증): contents allow headings 2-3 only, top-level ids are
// unique, the node count is within MAX_NODES and images belong to this exhibition. A scrap mark's sentenceId
// is owned by the server (assigned at publication): one the stored doc does not already hold becomes null.
async function checkedDoc(tx: Tx, exhibitionId: string, doc: StillDoc, existing: StillDoc): Promise<StillDoc> {
  const ids = doc.content.map((b) => b.attrs.id);
  if (new Set(ids).size !== ids.length) throw badRequest("node ids must be unique");
  if (doc.content.some((b) => b.type === "heading" && b.attrs.level === 1)) throw badRequest("headings in an item are level 2 or 3");
  if (countNodes(doc) > MAX_NODES) throw badRequest(`a document has at most ${MAX_NODES} nodes`);
  const imageIds = [...new Set(doc.content.flatMap((b) => (b.type === "stillImage" ? [b.attrs.imageId] : [])))];
  if (imageIds.length) {
    const own = await tx.select({ id: images.id }).from(images).where(and(eq(images.exhibitionId, exhibitionId), inArray(images.id, imageIds)));
    if (own.length !== imageIds.length) throw badRequest("imageId is not an image of this exhibition");
  }
  const stored = new Set(scrapRuns(existing).flatMap((run) => (run.sentenceId ? [run.sentenceId] : [])));
  const keepKnown = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(keepKnown);
    if (!value || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    if (node.type === "scrap") return { ...node, attrs: { sentenceId: stored.has(String((node.attrs as { sentenceId: unknown }).sentenceId)) ? (node.attrs as { sentenceId: unknown }).sentenceId : null } };
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, keepKnown(child)]));
  };
  return keepKnown(doc) as StillDoc;
}

// sources keys are top-level node ids of `doc`; their refs "{documentId}:{segmentId}" name documents of this exhibition.
async function checkedSources(tx: Tx, exhibitionId: string, doc: StillDoc, sources: ContentSources): Promise<ContentSources> {
  const ids = new Set(doc.content.map((b) => b.attrs.id));
  const unknownKey = Object.keys(sources).find((key) => !ids.has(key));
  if (unknownKey) throw badRequest(`sources names ${unknownKey}, which is not a node of the document`);
  const documentIds = [...new Set(Object.values(sources).flatMap((s) => s.refs.map((ref) => (SOURCE_REF.test(ref) ? ref.split(":")[0] : ref))))];
  if (documentIds.length) {
    const own = await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.exhibitionId, exhibitionId), inArray(documents.id, documentIds.filter((id) => z.uuid().safeParse(id).success))));
    if (own.length !== documentIds.length) throw badRequest("sources refer to a document that is not in this exhibition");
  }
  return sources;
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
export async function lockOwnedContent(tx: Tx, institutionId: string, id: string): Promise<Row> {
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

export async function createContent(exhibitionId: string, input: ContentEdit & { kind: Row["kind"]; doc: StillDoc }) {
  return db.transaction(async (tx) => {
    const doc = await checkedDoc(tx, exhibitionId, input.doc, EMPTY_DOC);
    const sources = await checkedSources(tx, exhibitionId, doc, input.sources ?? {});
    const [row] = await tx
      .insert(contents)
      .values({ exhibitionId, kind: input.kind, status: "READY", doc, sources, fields: input.fields ? checkedFields(input.fields, null) : null, editorialNote: input.editorialNote ?? null })
      .returning({ id: contents.id });
    return row.id;
  });
}

// One conditional UPDATE … WHERE id = $i AND revision = $r. A REJECTED item is terminal: CONFLICT.
export async function updateContent(
  { institutionId, userId }: { institutionId: string; userId: string },
  input: ContentEdit & { id: string; revision: string; status?: "APPROVED" | "READY" | "REJECTED" },
) {
  return db.transaction(async (tx) => {
    const row = await lockOwnedContent(tx, institutionId, input.id);
    if (row.revision !== input.revision) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    if (row.status === "REJECTED") throw new TRPCError({ code: "CONFLICT", message: "A rejected item cannot change; create a new one." });
    if (input.status === "APPROVED" && row.status === "APPROVED") throw new TRPCError({ code: "CONFLICT", message: "The item is already approved." });
    if (input.status === "READY" && row.status !== "APPROVED") throw new TRPCError({ code: "CONFLICT", message: "Only an approved item goes back to review." });

    const edits: Partial<typeof contents.$inferInsert> = {};
    if (input.kind !== undefined) edits.kind = input.kind;
    const stored = stillDoc.parse(row.doc);
    if (input.doc !== undefined || input.sources !== undefined) {
      const doc = input.doc ? await checkedDoc(tx, row.exhibitionId, input.doc, stored) : stored;
      // Sources not sent follow the doc: entries of removed nodes go.
      const kept = Object.fromEntries(Object.entries(contentSources.parse(row.sources)).filter(([key]) => doc.content.some((b) => b.attrs.id === key)));
      if (input.doc) edits.doc = doc;
      edits.sources = await checkedSources(tx, row.exhibitionId, doc, input.sources ?? kept);
    }
    if (input.fields !== undefined) edits.fields = input.fields && checkedFields(input.fields, row.fields);
    if (input.editorialNote !== undefined) edits.editorialNote = input.editorialNote;
    // Doc, source, field and kind edits send an APPROVED item back to READY (the editorial note does not).
    const contentEdited = input.kind !== undefined || input.doc !== undefined || input.sources !== undefined || input.fields !== undefined;
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
