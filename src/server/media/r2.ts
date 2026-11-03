import { AwsClient } from "aws4fetch";
import { z } from "zod";

const r2Env = z.object({
  R2_ENDPOINT: z.url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

// Sends one signed request for an object key.
function fetchObject(key: string, init: RequestInit) {
  const env = r2Env.parse(process.env);
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return client.fetch(`${env.R2_ENDPOINT}/${env.R2_BUCKET}/${key}`, init);
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
