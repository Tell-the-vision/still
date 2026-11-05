import { codeSchema } from "@still/shared/code";
import { storedDocument } from "@still/shared/document";
import { scrapRuns, stillDocument, type StillDocument } from "@still/shared/still-doc";
import { extname } from "node:path";
import type { ContentPackage } from "./content";
import { blocksToStill } from "./convert";

type PackageExhibition = ContentPackage["exhibitions"][number];

const PLAYLIST_PREFIX = {
  SPOTIFY: "https://open.spotify.com/",
  APPLE_MUSIC: "https://music.apple.com/",
};

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function imageContentType(file: string) {
  const type = IMAGE_CONTENT_TYPES[extname(file).slice(1).toLowerCase()];
  if (!type) throw new Error(`Unsupported image file "${file}" (use jpg, jpeg, png or webp)`);
  return type;
}

// Sentence ids referenced by a guide, in order (duplicates kept).
export function sentenceRefs(guide: StillDocument | null): string[] {
  return scrapRuns(guide ?? { content: [] }).flatMap((r) => (r.sentenceId ? [r.sentenceId] : []));
}

// Packages are written in blocks v1; the stored form is a STILL document (SPEC §11.8).
export function toStillDocument(label: string, doc: unknown, sentences: { id: string; content: string }[]): StillDocument | null {
  if (doc === null) return null;
  const blocks = storedDocument.safeParse(doc);
  const text = (id: string) => sentences.find((s) => s.id === id)?.content ?? "";
  const converted = blocks.success ? blocksToStill(blocks.data, text) : doc;
  const parsed = stillDocument.safeParse(converted);
  if (!parsed.success) throw new Error(`${label}: invalid document (${parsed.error.issues[0].message})`);
  return parsed.data;
}

function validateExhibition(e: PackageExhibition) {
  const label = `Exhibition "${e.code}"`;
  if (!codeSchema.safeParse(e.code).success) throw new Error(`${label}: invalid code`);
  if (!["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(e.state)) throw new Error(`${label}: invalid state "${e.state}"`);

  if (e.playlist) {
    const prefix = PLAYLIST_PREFIX[e.playlist.provider];
    if (!prefix || !e.playlist.url.startsWith(prefix)) {
      throw new Error(`${label}: playlist url does not match provider ${e.playlist.provider}`);
    }
  }

  const description = toStillDocument(`${label} description`, e.description, e.sentences);
  const guide = toStillDocument(`${label} guide`, e.guide, e.sentences);
  for (const image of e.images ?? []) imageContentType(image.file);
  const imageIds = new Set((e.images ?? []).map((i) => i.id));
  if (e.cover != null && !e.images?.[e.cover]) throw new Error(`${label}: cover index out of range`);
  for (const doc of [description, guide]) {
    if (doc?.content.some((b) => b.type === "stillImage" && !imageIds.has(b.attrs.imageId))) throw new Error(`${label}: image block references an unknown image`);
  }
  if (description && scrapRuns(description).length > 0) {
    throw new Error(`${label}: description must not contain sentence blocks`);
  }

  const refs = sentenceRefs(guide);
  if (new Set(refs).size !== refs.length) throw new Error(`${label}: a sentence is referenced more than once`);
  const known = new Set(e.sentences.map((s) => s.id));
  if (known.size !== e.sentences.length) throw new Error(`${label}: duplicate sentence id`);
  if (refs.some((id) => !known.has(id))) throw new Error(`${label}: guide references a sentence outside the exhibition`);
  if (refs.length !== known.size) throw new Error(`${label}: every sentence must be referenced by the guide exactly once`);
}

// Throws on the first problem, before anything is written.
export function validatePackage(pkg: ContentPackage) {
  const codes = pkg.exhibitions.map((e) => e.code);
  if (new Set(codes).size !== codes.length) throw new Error("Duplicate exhibition code in package");
  pkg.exhibitions.forEach(validateExhibition);
}
