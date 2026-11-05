import { contentBlocks } from "../../../../shared/src/console-content";
import { exhibitionDraft, type ExhibitionDraft } from "../../../../shared/src/console-draft";
import { stillDoc, type StillDocument } from "../../../../shared/src/still-doc";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import { contents, exhibitions, images, venues } from "../../db/schema";
import { compileDraft, type Compiled, type CompileContent } from "./compile";
import { exhibitionRows } from "./exhibition-rows";
import { consoleImageUrl } from "./image-files";

// console.preview.get (SPEC §9.4 미리보기와 발행 점검): the compiled draft in the visitor
// response shapes, the publication checks and what the compile left out.

type ImageRow = typeof images.$inferSelect;

// A check that did not pass blocks publication unless `warning` is true: a warning is shown
// but publication may go on. `ok` therefore means "does not block".
export type PublicationCheck = { id: string; title: string; ok: boolean; warning: boolean; detail: string };

// The URL is where the console shows the picture, published or not (image-files.ts); only the console reads it.
const previewImage = (image: ImageRow) => ({
  url: consoleImageUrl(image),
  altText: image.altText,
  width: image.width,
  height: image.height,
});

// The images a document's stillImage blocks point at; an image with no file at all has no URL.
function previewImages(docs: ({ content: StillDocument["content"] } | null)[], imageRows: ImageRow[]) {
  const used = new Set(docs.flatMap((d) => d?.content ?? []).flatMap((b) => (b.type === "stillImage" ? [b.attrs.imageId] : [])));
  return Object.fromEntries(imageRows.filter((i) => used.has(i.id)).map((i) => [i.id, previewImage(i)]));
}

const hasValue = (field: unknown) => {
  const value = field && typeof field === "object" && "value" in field ? field.value : field;
  return (typeof value === "string" && value.trim() !== "") || typeof value === "number";
};

const passes = (id: string, title: string, problems: string[], okDetail: string, opts: { warning?: boolean } = {}): PublicationCheck => ({
  id,
  title,
  ok: problems.length === 0 || !!opts.warning,
  warning: problems.length > 0 && !!opts.warning,
  detail: problems.length === 0 ? okDetail : problems.join("; "),
});

function runChecks(
  draft: ExhibitionDraft,
  code: string,
  venue: { name: string } | null,
  contentRows: CompileContent[],
  imageRows: ImageRow[],
  compiled: Compiled,
): PublicationCheck[] {
  const byId = new Map(contentRows.map((c) => [c.id, c]));
  const listed = draft.sections.filter((s) => s.visible).flatMap((s) => s.contentIds.map((id) => byId.get(id) ?? null));
  const approved = listed.filter((c) => c?.status === "APPROVED").length;

  const artworks = new Set(
    draft.sections.filter((s) => s.visible && s.kind !== "INTRODUCTION").flatMap((s) => s.contentIds)
      .map((id) => byId.get(id)).filter((c) => c?.status === "APPROVED" && c.kind === "ARTWORK"),
  );
  const incomplete = [...artworks].filter((c) => !c || !(hasValue(c.fields?.titleEn) || hasValue(c.fields?.titleKo) || hasValue(c.fields?.title)) || !hasValue(c.fields?.year));

  // The images the visitor would see: those in the documents, and the cover.
  const used = [...new Set([...compiled.imageIds, ...(draft.coverImageId ? [draft.coverImageId] : [])])];
  const usedRows = used.map((id) => ({ id, row: imageRows.find((i) => i.id === id) }));
  const imageProblems = (accepts: (image: ImageRow) => boolean, what: string) =>
    usedRows.filter(({ row }) => !row || !accepts(row)).map(({ id }) => `image ${id} ${what}`);

  const playlist = exhibitionDraft.shape.playlist.safeParse(draft.playlist);
  const basicInfo = [
    ...(draft.title.trim() ? [] : ["title is empty"]),
    ...(venue ? [] : ["venue is not set"]),
    ...(draft.startDate && draft.endDate ? [] : ["period is not set"]),
    ...(draft.startDate && draft.endDate && draft.endDate < draft.startDate ? ["period ends before it starts"] : []),
    ...(code ? [] : ["code is empty"]),
  ];

  return [
    passes("content-approval", "Content approval", approved === listed.length ? [] : [`${approved} of ${listed.length} contents in visible sections are approved`],
      `${approved} of ${listed.length} contents in visible sections are approved`),
    passes("artwork-metadata", "Artwork metadata", incomplete.length ? [`${incomplete.length} artwork contents have no title or year`] : [],
      `${artworks.size} artwork contents have a title and year`, { warning: true }),
    passes("image-rights", "Image rights", imageProblems((i) => i.rights === "CONFIRMED", "has no confirmed rights"), `${used.length} images have confirmed rights`),
    passes("image-verification", "Image verification", imageProblems((i) => i.verification === "VERIFIED" || i.verification === "NOT_APPLICABLE", "is not verified"),
      `${used.length} images are verified`),
    // An image without a public file yet gets one at publication, copied from its document's display file
    // (SPEC §10.9 step 2); an image that came from no document has nothing to copy.
    passes("image-files", "Image files", usedRows.filter(({ row }) => row?.objectKey === null && row.documentId === null).map(({ id }) => `image ${id} has no file to publish`),
      `${used.length} images have a file to publish`),
    passes("audio-link", "Audio link", playlist.success ? [] : ["playlist link does not match its provider"], draft.playlist ? "Playlist link is valid" : "No playlist"),
    passes("basic-info", "Basic info", basicInfo, "Title, venue, period and code are set"),
    passes("document-validation", "Document validation", compiled.invalid, "Description and guide are valid"),
  ];
}

// What publication and the preview both work from: the draft, the rows it points at and its compile.
export type LoadedDraft = {
  draft: ExhibitionDraft;
  venue: { name: string; city: string } | null;
  contentRows: CompileContent[];
  imageRows: ImageRow[];
  compiled: Compiled;
};

// Reads an exhibition's draft and compiles it. `lockContents` takes the contents' row locks, so that the
// publication transaction compiles what it then writes back (a content being rejected waits).
export async function loadDraft(executor: Pick<typeof db, "select">, exhibitionId: string, { lockContents = false } = {}): Promise<LoadedDraft> {
  const [{ draft: storedDraft }] = await executor.select({ draft: exhibitions.draft }).from(exhibitions).where(eq(exhibitions.id, exhibitionId));
  // The playlist rule is a publication check, so a draft that breaks it is still previewed.
  const { playlist } = storedDraft as { playlist: ExhibitionDraft["playlist"] };
  const draft = { ...exhibitionDraft.parse({ ...(storedDraft as object), playlist: null }), playlist };

  const [venue = null] = draft.venueId ? await executor.select({ name: venues.name, city: venues.city }).from(venues).where(eq(venues.id, draft.venueId)) : [];
  const contentQuery = executor.select().from(contents).where(eq(contents.exhibitionId, exhibitionId));
  const contentRows: CompileContent[] = (await (lockContents ? contentQuery.for("update") : contentQuery)).map((c) => ({
    id: c.id,
    kind: c.kind as CompileContent["kind"],
    status: c.status as CompileContent["status"],
    blocks: contentBlocks.parse(c.blocks),
    doc: stillDoc.parse(c.doc),
    fields: c.fields as CompileContent["fields"],
  }));
  const imageRows = await executor.select().from(images).where(eq(images.exhibitionId, exhibitionId));
  return { draft, venue, contentRows, imageRows, compiled: compileDraft(draft, contentRows, imageRows) };
}

export const publicationChecks = (code: string, { draft, venue, contentRows, imageRows, compiled }: LoadedDraft) =>
  runChecks(draft, code, venue, contentRows, imageRows, compiled);

export async function previewExhibition(institutionId: string, code: string) {
  const [row] = await exhibitionRows(institutionId, { where: eq(exhibitions.code, code) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const loaded = await loadDraft(db, row.id);
  const { draft, venue, contentRows, imageRows, compiled } = loaded;

  const cover = imageRows.find((i) => i.id === draft.coverImageId);
  return {
    // Mirrors exhibition.get (SPEC §3.3), built from the draft.
    exhibition: {
      code: row.code,
      title: draft.title,
      subtitle: draft.subtitle,
      description: compiled.description,
      venue,
      startDate: draft.startDate,
      endDate: draft.endDate,
      coverImage: cover ? { id: cover.id, ...previewImage(cover) } : null,
      audio: { playlist: draft.playlist, ambienceEnabled: draft.ambienceEnabled },
    },
    // Mirrors guide.get's document.
    guide: compiled.guide,
    // Every content's images too: the editor shows an item's pictures before it is approved and published.
    images: previewImages([compiled.description, compiled.guide, ...contentRows.map((c) => c.doc)], imageRows),
    checks: publicationChecks(row.code, loaded),
    losses: compiled.losses,
  };
}
