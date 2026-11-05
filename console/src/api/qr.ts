// GET /api/console/qr (SPEC §9.5): the QR of the exhibition's visitor URL, or with `artwork` (the first 8 characters
// of its content id) of that artwork's, drawn by the server.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const qrUrl = (code: string, format: "png" | "svg", artwork?: string) =>
  `${BASE}/api/console/qr?code=${encodeURIComponent(code)}&format=${format}${artwork ? `&artwork=${artwork}` : ""}`;

/**
 * Image sources for the QR of `visitorUrl`: the server's in server mode; drawn in the browser with the same
 * `qrcode` library in mock mode, where no server answers.
 */
export async function qrSources(code: string, visitorUrl: string, mock: boolean, artwork?: string): Promise<{ png: string; svg: string }> {
  if (!mock) return { png: qrUrl(code, "png", artwork), svg: qrUrl(code, "svg", artwork) };
  const QRCode = await import("qrcode");
  const png = await QRCode.toDataURL(visitorUrl, { margin: 1, width: 512 });
  const svg = URL.createObjectURL(new Blob([await QRCode.toString(visitorUrl, { type: "svg", margin: 1 })], { type: "image/svg+xml" }));
  return { png, svg };
}
