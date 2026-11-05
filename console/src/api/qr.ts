// GET /api/console/qr (SPEC §9.5): the QR of the exhibition's visitor URL, drawn by the server.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const qrUrl = (code: string, format: "png" | "svg") =>
  `${BASE}/api/console/qr?code=${encodeURIComponent(code)}&format=${format}`;
