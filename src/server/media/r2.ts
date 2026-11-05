import { AwsClient } from "aws4fetch";
import { z } from "zod";

const r2Env = z.object({
  R2_ENDPOINT: z.url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

function r2Client() {
  const env = r2Env.parse(process.env);
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return { client, env };
}

// Sends one signed request for an object key in the public media bucket.
function fetchObject(key: string, init: RequestInit) {
  const { client, env } = r2Client();
  return client.fetch(`${env.R2_ENDPOINT}/${env.R2_BUCKET}/${key}`, init);
}

// The private bucket holds institutions' uploaded originals (SPEC §9.4); it is never served publicly.
// Under R2_DRY_RUN=1 (e2e) nothing is signed and URLs point at a host that never resolves.
const DRY_RUN_ORIGIN = "https://r2.dry-run.invalid";
const dryRun = () => process.env.R2_DRY_RUN === "1";
// Required only where the private bucket is used, so the public media upload does not depend on it.
const PRESIGN_SECONDS = 900;
const privateBucket = () => (dryRun() ? "private-dry-run" : z.string().min(1).parse(process.env.R2_PRIVATE_BUCKET));

// A presigned PUT the browser uses to upload one original straight to the private bucket.
// The URL is valid 15 minutes and signs no headers beyond host, so the browser may send any Content-Type.
export async function presignPrivatePut(key: string) {
  if (dryRun()) return { url: `${DRY_RUN_ORIGIN}/${privateBucket()}/${key}`, headers: {} as Record<string, string> };
  const { client, env } = r2Client();
  const url = new URL(`${env.R2_ENDPOINT}/${privateBucket()}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_SECONDS));
  const signed = await client.sign(url.toString(), { method: "PUT", aws: { signQuery: true } });
  return { url: signed.url, headers: {} as Record<string, string> };
}

// A presigned GET the browser opens to download one original. Valid 15 minutes, like the PUT.
export async function presignPrivateGet(key: string) {
  const expiresAt = new Date(Date.now() + PRESIGN_SECONDS * 1000);
  if (dryRun()) return { url: `${DRY_RUN_ORIGIN}/${privateBucket()}/${key}`, expiresAt };
  const { client, env } = r2Client();
  const url = new URL(`${env.R2_ENDPOINT}/${privateBucket()}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_SECONDS));
  const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
  return { url: signed.url, expiresAt };
}

// Removes an original (or its manifest) from the private bucket. R2_DRY_RUN=1 skips the delete.
export async function deletePrivateObject(key: string) {
  if (dryRun()) return;
  const { client, env } = r2Client();
  const res = await client.fetch(`${env.R2_ENDPOINT}/${privateBucket()}/${key}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`R2 delete of ${key} failed: ${res.status}`);
}

// Writes an original from the server (pasted text only). R2_DRY_RUN=1 skips the write.
export async function putPrivateObject(key: string, bytes: Buffer, contentType: string) {
  if (dryRun()) return;
  const { client, env } = r2Client();
  const res = await client.fetch(`${env.R2_ENDPOINT}/${privateBucket()}/${key}`, {
    method: "PUT",
    body: new Uint8Array(bytes),
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2 upload of ${key} failed: ${res.status}`);
}

// The stored size of a private object in bytes, or null when it is not there. R2_DRY_RUN=1 skips the call
// and answers undefined (nothing to compare).
export async function privateObjectSize(key: string) {
  if (dryRun()) return undefined;
  const { client, env } = r2Client();
  const res = await client.fetch(`${env.R2_ENDPOINT}/${privateBucket()}/${key}`, { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 head of ${key} failed: ${res.status}`);
  return Number(res.headers.get("content-length"));
}

// Uploads an immutable, content-addressed object to R2 (SPEC §9). R2_DRY_RUN=1 skips the upload.
export async function putObject(key: string, bytes: Buffer, contentType: string) {
  if (process.env.R2_DRY_RUN === "1") return;
  const res = await fetchObject(key, {
    method: "PUT",
    body: new Uint8Array(bytes),
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new Error(`R2 upload of ${key} failed: ${res.status}`);
}

// Copies an image's display file from the private bucket to the public bucket under `publicKey`, inside R2
// (SPEC §10.9 발행 쓰기 경로 step 2); nothing is downloaded. R2_DRY_RUN=1 skips the copy.
// Unreachable until the extraction module (#65) writes manifests: no image has a private display file yet.
export async function copyPrivateToPublic(privateKey: string, publicKey: string) {
  if (dryRun()) return;
  const res = await fetchObject(publicKey, {
    method: "PUT",
    headers: {
      "x-amz-copy-source": `/${privateBucket()}/${privateKey}`,
      "x-amz-metadata-directive": "REPLACE",
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`R2 copy of ${privateKey} to ${publicKey} failed: ${res.status}`);
}

// Removes an object from R2 (SPEC §10.5). R2_DRY_RUN=1 skips the delete.
export async function deleteObject(key: string) {
  if (process.env.R2_DRY_RUN === "1") return;
  const res = await fetchObject(key, { method: "DELETE" });
  if (!res.ok) throw new Error(`R2 delete of ${key} failed: ${res.status}`);
}

// Lists every object key under a prefix, following ListObjectsV2 continuation tokens.
export async function listObjects(prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const query = new URLSearchParams({ "list-type": "2", prefix });
    if (token) query.set("continuation-token", token);
    const res = await fetchObject(`?${query}`, { method: "GET" });
    if (!res.ok) throw new Error(`R2 list of ${prefix} failed: ${res.status}`);
    const xml = await res.text();
    keys.push(...Array.from(xml.matchAll(/<Key>(.*?)<\/Key>/g), (m) => m[1]));
    token = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1];
  } while (token);
  return keys;
}
