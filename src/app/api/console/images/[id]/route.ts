import { and, eq } from "drizzle-orm";
import { currentConsoleSession } from "../../../../../server/auth/sessions";
import { db } from "../../../../../server/db/client";
import { exhibitions, images } from "../../../../../server/db/schema";
import { presignPrivateGet } from "../../../../../server/media/r2";
import { publicImageUrl } from "../../../../../server/media/public-url";
import { userAllowed } from "../../../../../server/rate-limit";
import { displayKeyOf } from "../../../../../server/services/console/image-files";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// How long the browser may reuse an answer: well inside the 15 minutes a presigned URL lasts.
const REUSE_SECONDS = 300;

// GET /api/console/images/{id}: the picture of one of the console session's own exhibition images, for the editor
// and its phone preview (SPEC §9.4 이미지 표시). An image extracted from a document shows its display file (manifest
// `display`, SPEC §10.7), published or not; any other image its public file. The answer is a redirect to a
// presigned GET made for this request, so the address itself never expires however long the editor stays open, and
// the bytes go from R2 to the browser, never through this server (SPEC §9.4 처리 구조). The object key is in no
// response body (SPEC §10.3). Another institution's image and an unknown one answer the same 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentConsoleSession();
  if (!session) return new Response(null, { status: 401 });
  // A temporary password allows changing it and nothing else (SPEC §10.5).
  if (session.mustChangePassword) return new Response(null, { status: 403 });
  if (!userAllowed(session.userId)) return new Response(null, { status: 429 });

  const { id } = await params;
  const [image] = UUID.test(id)
    ? await db
        .select({ id: images.id, exhibitionId: images.exhibitionId, objectKey: images.objectKey, documentId: images.documentId, manifestAssetId: images.manifestAssetId })
        .from(images)
        .innerJoin(exhibitions, eq(exhibitions.id, images.exhibitionId))
        .where(and(eq(images.id, id), eq(exhibitions.institutionId, session.institutionId)))
    : [];
  if (!image) return new Response(null, { status: 404 });

  const displayKey = displayKeyOf(session.institutionId, image);
  const location = displayKey ? (await presignPrivateGet(displayKey)).url : image.objectKey ? publicImageUrl(image.objectKey) : null;
  if (!location) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    // The answer depends on the session cookie: another sign-in in this browser must not reuse it.
    headers: { Location: location, "Cache-Control": `private, max-age=${REUSE_SECONDS}`, Vary: "Cookie" },
  });
}
