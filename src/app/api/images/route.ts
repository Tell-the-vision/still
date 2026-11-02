import { db } from "@/db";
import { images } from "@/db/schema";
import { handler, HttpError, ok, requireUser } from "@/lib/api";
import { isArtist } from "@/lib/api";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB (client resizes before upload)
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/images  (multipart/form-data, field "file")
 * Stores the image in the database and returns { id, url }.
 * Artists and admins only (cover images for exhibitions).
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
  const [row] = await db
    .insert(images)
    .values({ ownerId: user.id, mimeType: file.type, bytes, size: bytes.length, width, height })
    .returning({ id: images.id });
  return ok({ id: row.id, url: `/api/images/${row.id}` }, 201);
});
