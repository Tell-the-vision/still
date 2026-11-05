import { finish, normaliseSpaces, type ExtractContext, type Manifest, type RawSegment } from "./manifest";

// UTF-8 first; files saved by Korean editors are often CP949 (SPEC §9.4 추출, TXT / MD).
function decode(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

// One segment per non-empty line, all on page 1 (a text file has no pages, so its single page has no size).
export async function extractText(file: File, mediaType: string, context: ExtractContext): Promise<Manifest> {
  const lines = decode(await file.arrayBuffer()).split(/\r\n|\r|\n/).map(normaliseSpaces).filter(Boolean);
  const segments = lines.map((text): RawSegment => ({ page: 1, bbox: null, text }));
  return finish(context, mediaType, [{ page: 1, size: [0, 0] }], segments);
}
