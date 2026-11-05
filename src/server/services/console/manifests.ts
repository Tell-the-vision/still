import { manifest, type Manifest } from "@still/shared/manifest";
import { getPrivateObject, modelInputSize, privateObjectSize } from "../../media/r2";

// Extraction manifests (SPEC §10.6): reading them back and checking them. Keys are immutable
// ({institutionId}/{exhibitionId}/{documentId}/manifest.v{n}.json), so a parsed manifest is cached by key.

const MANIFEST_MAX_BYTES = 50 * 1024 * 1024;

// The prefix every object of a document lives under.
export const documentPrefix = (institutionId: string, exhibitionId: string, documentId: string) => `${institutionId}/${exhibitionId}/${documentId}/`;

// The files extraction may write, named relative to the document prefix (SPEC §9.4 버킷과 키).
const MANIFEST_NAME = /^manifest\.v([1-9]\d*)\.json$/;
const PAGE_NAME = /^pages\/p\d{3,}\.png$/;
const ASSET_NAME = /^assets\/a\d{2,}\.(?:display\.webp|[a-z0-9]{1,5})$/;
// Model inputs live in their own bucket under {documentId}/v{n}/ (a name here is that whole key).
const modelInputName = (documentId: string) => new RegExp(`^${documentId}/v[1-9]\\d*/(?:page-\\d{3,}\\.webp|a\\d{2,}\\.jpg)$`);

export type ExtractionFile = { bucket: "private" | "model-inputs"; name: string };

// Which bucket an extraction output goes to, or null when the name is not an allowed output.
export function extractionFileOf(documentId: string, name: string): ExtractionFile | null {
  if (MANIFEST_NAME.test(name) || PAGE_NAME.test(name) || ASSET_NAME.test(name)) return { bucket: "private", name };
  return modelInputName(documentId).test(name) ? { bucket: "model-inputs", name } : null;
}

// The version n of a manifest key under `prefix`, or null when the key is not that document's manifest.
export function manifestVersionOf(prefix: string, key: string) {
  if (!key.startsWith(prefix)) return null;
  const match = MANIFEST_NAME.exec(key.slice(prefix.length));
  return match ? Number(match[1]) : null;
}

const cache = new Map<string, Manifest>();

// Reads and parses a stored manifest; throws when it is missing or does not match the schema.
// Cached in-process by key. Manifests are only trusted after console.document.update has validated them.
export async function readManifest(key: string): Promise<Manifest> {
  const cached = cache.get(key);
  if (cached) return cached;
  const parsed = await fetchManifest(key);
  if (!parsed) throw new Error(`Manifest ${key} is missing or invalid`);
  cache.set(key, parsed);
  return parsed;
}

// The manifest at `key` if it is there and fits the schema, else null.
async function fetchManifest(key: string) {
  const stored = await privateObjectSize(key);
  if (stored === null || stored > MANIFEST_MAX_BYTES) return null;
  const bytes = await getPrivateObject(key);
  if (!bytes) return null;
  try {
    const parsed = manifest.safeParse(JSON.parse(bytes.toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const unique = (ids: string[]) => new Set(ids).size === ids.length;

// SPEC §10.6 검증: the manifest at `key` for the document, or null when any check fails. Nothing the manifest
// names may lie outside this document: its files are named relative to the prefix and must be allowed outputs.
export async function validateManifest(doc: { id: string; sha256: string; prefix: string }, key: string): Promise<Manifest | null> {
  const m = await fetchManifest(key);
  if (!m) return null;
  if (m.document.documentId !== doc.id || m.document.sha256 !== doc.sha256) return null;
  if (!unique(m.segments.map((s) => s.id)) || !unique(m.assets.map((a) => a.id))) return null;
  if (m.segments.some((s) => s.sentences.join(" ") !== s.text)) return null;

  const privateNames = m.pages.flatMap((p) => (p.render ? [p.render] : []));
  for (const asset of m.assets) {
    if (!asset.object.startsWith(`assets/${asset.id}.`) || asset.display !== `assets/${asset.id}.display.webp`) return null;
    privateNames.push(asset.object, asset.display);
  }
  const modelKeys = m.modelInputs.map((i) => i.key);
  const allowed = privateNames.every((n) => extractionFileOf(doc.id, n)?.bucket === "private") && modelKeys.every((k) => extractionFileOf(doc.id, k)?.bucket === "model-inputs");
  if (!allowed) return null;

  const present = await Promise.all([
    ...privateNames.map((n) => privateObjectSize(doc.prefix + n)),
    ...modelKeys.map((k) => modelInputSize(k)),
  ]);
  if (present.some((size) => size === null)) return null;
  cache.set(key, m);
  return m;
}
