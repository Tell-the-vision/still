import { eq } from "drizzle-orm";
import { userAllowed } from "../../../../server/rate-limit";
import { db } from "../../../../server/db/client";
import { archives, digitalKeepsakes } from "../../../../server/db/schema";
import { renderKeepsakePng } from "../../../../server/media/keepsake-png";
import { verifyTicket } from "../../../../server/media/keepsake-ticket";
import { guidePage } from "../../../../server/services/guide-pages";
import { completeExhibition } from "../../../../server/services/visible";

// SPEC §7.3: the ticket is a bearer link, so it is never logged.
export async function GET(req: Request) {
  const payload = verifyTicket(new URL(req.url).searchParams.get("ticket") ?? "");
  if (!payload) return new Response(null, { status: 403 });
  if (!userAllowed(payload.userId)) return new Response(null, { status: 429 });
  const archive = await db.query.archives.findFirst({
    where: eq(archives.id, payload.archiveId),
    with: { keepsakes: { where: eq(digitalKeepsakes.page, payload.page) }, exhibition: { with: { venue: true } } },
  });
  const keepsake = archive?.keepsakes[0];
  if (!archive || !keepsake) return new Response(null, { status: 404 });
  if (archive.userId !== payload.userId || keepsake.updatedAt.toISOString() !== payload.updatedAt) {
    return new Response(null, { status: 403 });
  }
  const { sentences, journalExcerpt } = keepsake.contentData as {
    sentences: { sentenceId: string; content: string }[];
    journalExcerpt: string | null;
  };
  // The card carries its page: the artwork's title and picture.
  const exhibition = completeExhibition(archive.exhibition);
  const shown = await guidePage(exhibition.guide, payload.page);
  const image = await renderKeepsakePng({ exhibition: { ...exhibition, title: shown.title || exhibition.title }, sentences, journalExcerpt, image: shown.image }, keepsake.templateId);
  const seconds = Math.max(0, Math.floor((payload.exp - Date.now()) / 1000));
  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="still-${archive.exhibition.code}-${payload.page}.png"`,
      "Cache-Control": `private, max-age=${seconds}`,
    },
  });
}
