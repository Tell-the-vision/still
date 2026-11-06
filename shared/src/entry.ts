import { CODE_REGEX } from "./code";

// An exhibition's address, or one of its works' (/e/{code}/{page}, the 8 hex characters of guidePages).
const EXHIBITION_PATH = /^\/e\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([0-9a-f]{8}))?\/?$/;

// SPEC §1.2: accepts a bare code or a STILL exhibition or artwork URL (every printed QR is an artwork's); anything else
// is null.
export function parseExhibitionTarget(value: string, stillOrigin: string): { code: string; page?: string } | null {
  const text = value.trim();
  if (CODE_REGEX.test(text)) return { code: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.origin !== stillOrigin) return null;
  const match = EXHIBITION_PATH.exec(url.pathname);
  if (!match) return null;
  return match[2] ? { code: match[1], page: match[2] } : { code: match[1] };
}
