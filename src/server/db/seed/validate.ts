import { codeSchema } from "@still/shared/code";
import { storedDocument, type StoredDocument } from "@still/shared/document";
import type { ContentPackage } from "./content";

type PackageExhibition = ContentPackage["exhibitions"][number];

const PLAYLIST_PREFIX = {
  SPOTIFY: "https://open.spotify.com/",
  APPLE_MUSIC: "https://music.apple.com/",
};

// Sentence ids referenced by a guide, in order (duplicates kept).
export function sentenceRefs(guide: StoredDocument | null): string[] {
  return (guide?.blocks ?? []).flatMap((b) => (b.type === "sentence" ? [b.sentenceId] : []));
}

function parseDocument(label: string, doc: unknown): StoredDocument | null {
  if (doc === null) return null;
  const parsed = storedDocument.safeParse(doc);
  if (!parsed.success) throw new Error(`${label}: invalid document (${parsed.error.issues[0].message})`);
  return parsed.data;
}

function validateExhibition(e: PackageExhibition) {
  const label = `Exhibition "${e.code}"`;
  if (!codeSchema.safeParse(e.code).success) throw new Error(`${label}: invalid code`);
  if (e.status !== "DRAFT" && e.status !== "PUBLISHED") throw new Error(`${label}: invalid status "${e.status}"`);

  if (e.playlist) {
    const prefix = PLAYLIST_PREFIX[e.playlist.provider];
    if (!prefix || !e.playlist.url.startsWith(prefix)) {
      throw new Error(`${label}: playlist url does not match provider ${e.playlist.provider}`);
    }
  }

  const description = parseDocument(`${label} description`, e.description);
  const guide = parseDocument(`${label} guide`, e.guide);
  const imageIds = new Set((e.images ?? []).map((i) => i.id));
  if (e.cover != null && !e.images?.[e.cover]) throw new Error(`${label}: cover index out of range`);
  for (const doc of [description, guide]) {
    if (doc?.blocks.some((b) => b.type === "image" && !imageIds.has(b.imageId))) throw new Error(`${label}: image block references an unknown image`);
  }
  if (description?.blocks.some((b) => b.type === "sentence")) {
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
