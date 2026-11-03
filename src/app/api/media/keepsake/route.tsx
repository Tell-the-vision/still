import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { db } from "../../../../server/db/client";
import { archives } from "../../../../server/db/schema";
import { verifyTicket } from "../../../../server/media/keepsake-ticket";

// SPEC §7.3: the ticket is a bearer link, so it is never logged.
export async function GET(req: Request) {
  const payload = verifyTicket(new URL(req.url).searchParams.get("ticket") ?? "");
  if (!payload) return new Response(null, { status: 403 });
  const archive = await db.query.archives.findFirst({
    where: eq(archives.id, payload.archiveId),
    with: { keepsake: true, exhibition: true },
  });
  if (!archive?.keepsake) return new Response(null, { status: 404 });
  if (archive.userId !== payload.userId || archive.keepsake.updatedAt.toISOString() !== payload.updatedAt) {
    return new Response(null, { status: 403 });
  }
  const { sentences } = archive.keepsake.contentData as { sentences: { sentenceId: string; content: string }[] };
  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 96, background: "white", color: "black" }}>
        <div style={{ fontSize: 64 }}>{archive.exhibition.title}</div>
        {sentences.map((s) => (
          <div key={s.sentenceId} style={{ fontSize: 40, marginTop: 48 }}>{s.content}</div>
        ))}
      </div>
    ),
    { width: 1080, height: 1440 },
  );
  const seconds = Math.max(0, Math.floor((payload.exp - Date.now()) / 1000));
  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="still-${archive.exhibition.code}.png"`,
      "Cache-Control": `private, max-age=${seconds}`,
    },
  });
}
