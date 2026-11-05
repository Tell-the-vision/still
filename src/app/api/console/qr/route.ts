import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { currentConsoleSession } from "../../../../server/auth/sessions";
import { exhibitions } from "../../../../server/db/schema";
import { userAllowed } from "../../../../server/rate-limit";
import { exhibitionRows } from "../../../../server/services/console/exhibition-rows";

// High error correction so a printed code survives wear.
const OPTIONS = { errorCorrectionLevel: "H", margin: 2 } as const;

const FORMATS = {
  png: { contentType: "image/png", render: async (url: string) => new Uint8Array(await QRCode.toBuffer(url, { ...OPTIONS, type: "png", width: 720 })) },
  svg: { contentType: "image/svg+xml", render: (url: string) => QRCode.toString(url, { ...OPTIONS, type: "svg" }) },
} as const;

// SPEC §9.5: the QR of {STILL_ORIGIN}/e/{code} (SPEC §1.2) for one of the console session's own
// exhibitions. The URL is fixed when the exhibition is created, so every state is allowed.
// Another institution's code and an unknown one answer the same 404.
export async function GET(req: Request) {
  const session = await currentConsoleSession();
  // A session still on its temporary password may only change it, see itself or sign out (SPEC §10.5).
  if (!session || session.mustChangePassword) return new Response(null, { status: 401 });
  if (!userAllowed(session.userId)) return new Response(null, { status: 429 });

  const params = new URL(req.url).searchParams;
  const code = params.get("code") ?? "";
  const format = params.get("format") ?? "";
  if (!Object.hasOwn(FORMATS, format)) return new Response(null, { status: 400 });
  const { contentType, render } = FORMATS[format as keyof typeof FORMATS];

  const [exhibition] = await exhibitionRows(session.institutionId, { where: eq(exhibitions.code, code), limit: 1 });
  if (!exhibition) return new Response(null, { status: 404 });

  const body = await render(`${process.env.STILL_ORIGIN}/e/${encodeURIComponent(exhibition.code)}`);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${exhibition.code}-qr.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
