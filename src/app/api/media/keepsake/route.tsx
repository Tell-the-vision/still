import { eq } from "drizzle-orm";
import { userAllowed } from "../../../../server/rate-limit";
import { db } from "../../../../server/db/client";
import { archives } from "../../../../server/db/schema";
import { renderKeepsakePng } from "../../../../server/media/keepsake-png";
import { publicImageUrl } from "../../../../server/media/public-url";
import { verifyTicket } from "../../../../server/media/keepsake-ticket";

// SPEC §7.3: the ticket is a bearer link, so it is never logged.
export async function GET(req: Request) {
  const payload = verifyTicket(new URL(req.url).searchParams.get("ticket") ?? "");
  if (!payload) return new Response(null, { status: 403 });
  if (!userAllowed(payload.userId)) return new Response(null, { status: 429 });
  const archive = await db.query.archives.findFirst({
    where: eq(archives.id, payload.archiveId),
    with: { keepsake: true, exhibition: { with: { venue: true, coverImage: true } } },
  });
  if (!archive?.keepsake) return new Response(null, { status: 404 });
  if (archive.userId !== payload.userId || archive.keepsake.updatedAt.toISOString() !== payload.updatedAt) {
    return new Response(null, { status: 403 });
  }
  const { sentences, journalExcerpt } = archive.keepsake.contentData as {
    sentences: { sentenceId: string; content: string }[];
    journalExcerpt: string | null;
  };
  const { coverImage } = archive.exhibition;
  const image = await renderKeepsakePng({ exhibition: archive.exhibition, sentences, journalExcerpt, image: coverImage && { url: publicImageUrl(coverImage.objectKey) } }, archive.keepsake.templateId);
  const seconds = Math.max(0, Math.floor((payload.exp - Date.now()) / 1000));
  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="still-${archive.exhibition.code}.png"`,
      "Cache-Control": `private, max-age=${seconds}`,
    },
  });
}
