import { and, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { currentConsoleSession } from "../../../../server/auth/sessions";
import { db } from "../../../../server/db/client";
import { contents, exhibitions } from "../../../../server/db/schema";
import { userAllowed } from "../../../../server/rate-limit";
import { exhibitionRows } from "../../../../server/services/console/exhibition-rows";

// High error correction so a printed code survives wear.
const OPTIONS = { errorCorrectionLevel: "H", margin: 2 } as const;

const FORMATS = {
  png: { contentType: "image/png", render: async (url: string) => new Uint8Array(await QRCode.toBuffer(url, { ...OPTIONS, type: "png", width: 720 })) },
  svg: { contentType: "image/svg+xml", render: (url: string) => QRCode.toString(url, { ...OPTIONS, type: "svg" }) },
} as const;

// SPEC §9.5: the QR of {STILL_ORIGIN}/e/{code} (SPEC §1.2) for one of the console session's own
// exhibitions, or with `artwork` (the first 8 characters of one of its contents' id) the QR of that
// artwork, {STILL_ORIGIN}/e/{code}/{artwork}, posted beside the work. The URL is fixed when the exhibition
// or the content is created, so every state is allowed. Another institution's code, an unknown one and
// an artwork that is not the exhibition's answer the same 404.
export async function GET(req: Request) {
  const session = await currentConsoleSession();
  if (!session) return new Response(null, { status: 401 });
  if (!userAllowed(session.userId)) return new Response(null, { status: 429 });

  const params = new URL(req.url).searchParams;
  const code = params.get("code") ?? "";
  const format = params.get("format") ?? "";
  if (!Object.hasOwn(FORMATS, format)) return new Response(null, { status: 400 });
  const { contentType, render } = FORMATS[format as keyof typeof FORMATS];

  const artwork = params.get("artwork");
  if (artwork !== null && !/^[0-9a-f]{8}$/.test(artwork)) return new Response(null, { status: 400 });

  const [exhibition] = await exhibitionRows(session.institutionId, { where: eq(exhibitions.code, code), limit: 1 });
  if (!exhibition) return new Response(null, { status: 404 });
  if (artwork) {
    const [content] = await db.select({ id: contents.id }).from(contents)
      .where(and(eq(contents.exhibitionId, exhibition.id), sql`${contents.id}::text LIKE ${`${artwork}%`}`)).limit(1);
    if (!content) return new Response(null, { status: 404 });
  }

  const path = `/e/${encodeURIComponent(exhibition.code)}${artwork ? `/${artwork}` : ""}`;
  const body = await render(`${process.env.STILL_ORIGIN}${path}`);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${exhibition.code}${artwork ? `-${artwork}` : ""}-qr.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
