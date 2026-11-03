import { db } from "@/db";
import { images } from "@/db/schema";
import { handler, HttpError, ok, requireUser } from "@/lib/api";
import { isArtist } from "@/lib/api";
import { objectKey, putObject, r2Enabled } from "@/lib/storage";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB (client resizes before upload)
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/images  (multipart/form-data, field "file")
 * Stores the image and returns { id, url }. With R2 configured (see
 * lib/storage.ts) the file goes to the bucket and `url` is its public
 * MEDIA_BASE_URL address; otherwise it is kept in the database and served
 * from /api/images/{id}. Artists and admins only (exhibition cover images).
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  if (!isArtist(user)) throw new HttpError("FORBIDDEN", "승인된 아티스트만 이미지를 올릴 수 있습니다.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError("BAD_REQUEST", "multipart/form-data 형식이어야 합니다.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError("VALIDATION_FAILED", "file 필드가 필요합니다.");
  if (!ALLOWED.has(file.type)) throw new HttpError("VALIDATION_FAILED", "JPEG, PNG, WebP 이미지만 올릴 수 있습니다.");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError("VALIDATION_FAILED", "이미지는 3MB 이하여야 합니다.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;

  if (r2Enabled) {
    const key = objectKey("covers", file.type);
    try {
      const stored = await putObject(key, bytes, file.type);
      return ok({ id: key, url: stored.url, storage: "r2" }, 201);
    } catch (err) {
      console.error("[still] R2 upload failed, falling back to database storage:", err);
    }
  }

  const [row] = await db
    .insert(images)
    .values({ ownerId: user.id, mimeType: file.type, bytes, size: bytes.length, width, height })
    .returning({ id: images.id });
  return ok({ id: row.id, url: `/api/images/${row.id}`, storage: "db" }, 201);
});
