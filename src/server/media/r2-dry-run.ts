import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// A local stand-in for the private R2 buckets, used only under R2_DRY_RUN=1 (dev without R2, every e2e run).
// Objects are plain files at <root>/<bucket>/<key>; /api/r2-dry-run/<bucket>/<key> serves them to the browser.

export const dryRunEnabled = () => process.env.R2_DRY_RUN === "1";
const root = () => path.resolve(process.env.R2_DRY_RUN_DIR || path.join(os.tmpdir(), "still-r2-dry-run"));

// The URL path the stand-in route serves for one object (relative: the browser sends it to this app).
export const dryRunUrl = (bucket: string, key: string) => `/api/r2-dry-run/${bucket}/${key}`;

// The file behind `bucket/key`, or null when either would leave the directory: only plain, non-empty segments pass.
function fileOf(bucket: string, key: string) {
  const segments = [bucket, ...key.split("/")];
  if (segments.some((s) => s === "" || s === "." || s === ".." || /[\\\0]/.test(s))) return null;
  const file = path.resolve(root(), ...segments);
  return file.startsWith(root() + path.sep) ? file : null;
}
const need = (bucket: string, key: string) => {
  const file = fileOf(bucket, key);
  if (!file) throw new Error(`Refused dry-run key ${bucket}/${key}`);
  return file;
};

export async function dryRunPut(bucket: string, key: string, bytes: Uint8Array) {
  const file = need(bucket, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

// The object's bytes, or null when it is not stored.
export async function dryRunGet(bucket: string, key: string) {
  const file = need(bucket, key);
  return readFile(file).catch((e: NodeJS.ErrnoException) => (e.code === "ENOENT" || e.code === "EISDIR" ? null : Promise.reject(e)));
}

// The object's size in bytes, or null when it is not stored.
export async function dryRunSize(bucket: string, key: string) {
  const info = await stat(need(bucket, key)).catch((e: NodeJS.ErrnoException) => (e.code === "ENOENT" ? null : Promise.reject(e)));
  return info?.isFile() ? info.size : null;
}

export async function dryRunDelete(bucket: string, key: string) {
  await rm(need(bucket, key), { force: true });
}

// Whether a request path (already split into segments) names a storable object; the route answers 404 otherwise.
export const dryRunPathOk = (segments: string[]) => segments.length >= 2 && fileOf(segments[0], segments.slice(1).join("/")) !== null;
