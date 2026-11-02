import QRCode from "qrcode";
import { apiError, handler, type Params } from "@/lib/api";
import { exhibitionUrl, findExhibition } from "@/lib/exhibitions";

/**
 * GET /api/exhibitions/{id|slug}/qr — SVG QR code pointing at /e/<slug>.
 * Print this for the venue. Query `?format=png` returns a PNG instead.
 */
export const GET = handler(async (req, { params }: Params<{ id: string }>) => {
  const { id } = await params;
  const exhibition = await findExhibition(id);
  if (!exhibition) return apiError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");

  const origin = new URL(req.url).origin;
  const target = exhibitionUrl(exhibition.slug, origin);
  const format = new URL(req.url).searchParams.get("format");

  if (format === "png") {
    const buf = await QRCode.toBuffer(target, { type: "png", width: 512, margin: 2 });
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  }
  const svg = await QRCode.toString(target, { type: "svg", margin: 2 });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
});
