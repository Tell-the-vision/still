/**
 * Object storage for uploaded media (exhibition cover images).
 *
 * Two backends, chosen by environment:
 *  - Cloudflare R2 (S3-compatible) when R2_ENDPOINT / R2_ACCESS_KEY_ID /
 *    R2_SECRET_ACCESS_KEY / R2_BUCKET are set. Files are served from
 *    MEDIA_BASE_URL (the bucket's public custom domain), so the app never
 *    proxies image bytes.
 *  - Database (`images` table, bytea) otherwise — zero-config local dev.
 *
 * Only `src/app/api/images/route.ts` knows about this; everything else just
 * stores the returned URL string in `exhibitions.cover_image_url`.
 */

export type StoredObject = { url: string; key: string };

export const r2Config = (() => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = (process.env.MEDIA_BASE_URL || "").replace(/\/+$/, "");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket, publicBase };
})();

export const r2Enabled = Boolean(r2Config);

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Object key for a new upload, e.g. `covers/2026/11/<uuid>.jpg`. */
export function objectKey(prefix: string, mimeType: string) {
  const d = new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}/${ym}/${crypto.randomUUID()}.${EXT[mimeType] ?? "bin"}`;
}

let client: import("@aws-sdk/client-s3").S3Client | null = null;

async function s3() {
  if (!r2Config) throw new Error("R2 is not configured");
  if (!client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    client = new S3Client({
      region: "auto",
      endpoint: r2Config.endpoint,
      credentials: { accessKeyId: r2Config.accessKeyId, secretAccessKey: r2Config.secretAccessKey },
      // R2 works with virtual-hosted style too, but path style is the
      // documented default for the <account>.r2.cloudflarestorage.com endpoint.
      forcePathStyle: true,
    });
  }
  return client;
}

/** Upload bytes to R2 and return the public URL (MEDIA_BASE_URL + key). */
export async function putObject(key: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
  if (!r2Config) throw new Error("R2 is not configured");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await s3()).send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  // Without a public domain the object is not readable by browsers; fall back
  // to the endpoint URL so at least the key is traceable in that case.
  const url = r2Config.publicBase ? `${r2Config.publicBase}/${key}` : `${r2Config.endpoint}/${r2Config.bucket}/${key}`;
  return { url, key };
}
