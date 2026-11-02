import { CODE_REGEX } from "./code";

const EXHIBITION_PATH = /^\/e\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

// SPEC §1.2: accepts a bare code or a STILL exhibition URL; anything else is null.
export function parseExhibitionTarget(value: string, stillOrigin: string): { code: string } | null {
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
  return match ? { code: match[1] } : null;
}
