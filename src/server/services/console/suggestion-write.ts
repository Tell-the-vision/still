import { contentSources, stillDoc } from "@still/shared/still-doc";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { contents, exhibitions } from "../../db/schema";
import { AppError } from "../../trpc/init";
import { lockOwnedContent } from "./content-write";
import { applySuggestion } from "./suggestion-apply";

// Deciding a suggestion (SPEC §10.8 제안 수락·버리기): the status changes on the same row, under the item's revision rule.

export type Suggestion = {
  id: string;
  kind: string;
  target?: { node?: string };
  proposal?: Record<string, unknown>;
  status: "OPEN" | "ACCEPTED" | "DISMISSED";
  decidedBy: string | null;
  decidedAt: string | null;
};
// Suggestions that keep an item in NEEDS_REVIEW while they are open.
const NEEDS_CHECK = ["TEXT_MISMATCH", "LABEL_GENERATED", "IMAGE_NOT_ANALYZED", "SOURCE_CONFLICT"];

const parse = (value: unknown) => (Array.isArray(value) ? (value as Suggestion[]) : []);
const decide = (list: Suggestion[], id: string, status: "ACCEPTED" | "DISMISSED", userId: string) => {
  if (!list.some((s) => s.id === id)) throw new TRPCError({ code: "NOT_FOUND" });
  return list.map((s) => (s.id === id ? { ...s, status, decidedBy: userId, decidedAt: new Date().toISOString() } : s));
};
export async function decideSuggestion(
  { institutionId, userId }: { institutionId: string; userId: string },
  input: { contentId?: string; id: string; status: "ACCEPTED" | "DISMISSED"; revision: string },
) {
  return db.transaction(async (tx) => {
    if (!input.contentId) throw new TRPCError({ code: "BAD_REQUEST", message: "contentId is required" });
    const row = await lockOwnedContent(tx, institutionId, input.contentId);
    if (row.revision !== input.revision) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    const list = decide(parse(row.suggestions), input.id, input.status, userId);
    const decided = list.find((s) => s.id === input.id)!;
    const doc = stillDoc.parse(row.doc);
    const applied = input.status === "ACCEPTED" ? applySuggestion(doc, contentSources.parse(row.sources), decided) : { doc, sources: row.sources };
    const edited = applied.doc !== doc;
    const stillOpen = list.some((s) => s.status === "OPEN" && NEEDS_CHECK.includes(s.kind));
    const status = edited && row.status === "APPROVED" ? "READY" : row.status === "NEEDS_REVIEW" && !stillOpen ? "READY" : row.status;
    const updated = await tx
      .update(contents)
      .set({
        suggestions: list,
        ...(edited ? { doc: applied.doc, sources: applied.sources } : {}),
        status,
        approvedAt: status === "APPROVED" ? row.approvedAt : null,
        approvedBy: status === "APPROVED" ? row.approvedBy : null,
        revision: sql`gen_random_uuid()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(contents.id, row.id), eq(contents.revision, input.revision)))
      .returning({ revision: contents.revision });
    if (!updated.length) throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("REVISION_MISMATCH") });
    return { contentId: row.id, id: input.id, status: input.status, revision: updated[0].revision };
  });
}

// Open and decided suggestions of the exhibition: each item's (with the item's revision) and the exhibition-wide ones.
export async function listSuggestions(exhibitionId: string) {
  const rows = await db.select({ id: contents.id, revision: contents.revision, suggestions: contents.suggestions }).from(contents).where(eq(contents.exhibitionId, exhibitionId)).orderBy(contents.createdAt, contents.id);
  const [ex] = await db.select({ analysis: exhibitions.analysis }).from(exhibitions).where(eq(exhibitions.id, exhibitionId));
  const wide = parse((ex?.analysis as { suggestions?: unknown } | null)?.suggestions);
  return [
    ...rows.flatMap((r) => parse(r.suggestions).map((s) => ({ ...s, contentId: r.id as string | null, revision: r.revision as string | null }))),
    ...wide.map((s) => ({ ...s, contentId: null, revision: null })),
  ];
}
