import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPublishedExhibition, toExhibition } from "../../../server/services/exhibitions";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Serves the SPA shell with per-exhibition metadata so shared links preview well.
// Unknown or draft codes get the untouched shell; the app shows its own unavailable state.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let html = await readFile(path.join(process.cwd(), "public", "index.html"), "utf8");
  const exhibition = await getPublishedExhibition(code)
    .then(toExhibition)
    .catch(() => null);
  if (exhibition) {
    const meta = {
      "og:title": exhibition.title,
      "og:description": `${exhibition.venue.name}, ${exhibition.venue.city}`,
      "og:url": `${process.env.STILL_ORIGIN}/e/${encodeURIComponent(code)}`,
      ...(exhibition.coverImage && { "og:image": exhibition.coverImage.url }),
    };
    const tags = Object.entries(meta)
      .map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">`)
      .join("");
    html = html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(exhibition.title)}</title>`)
      .replace("</head>", () => `${tags}</head>`);
  }
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}
