import { extractImage } from "./image";
import { extractPdf } from "./pdf";
import { extractText } from "./text";
import type { ExtractContext, Extraction } from "./manifest";

export type { Extraction, Manifest } from "./manifest";

const TEXT_TYPES: Record<string, string> = { txt: "text/plain", md: "text/markdown" };
// Pictures by file extension (SPEC §9.4 업로드): the media type, and the extension the server names the original with.
const PICTURE_TYPES: Record<string, { mediaType: string; ext: string }> = {
  jpg: { mediaType: "image/jpeg", ext: "jpg" },
  jpeg: { mediaType: "image/jpeg", ext: "jpg" },
  png: { mediaType: "image/png", ext: "png" },
  webp: { mediaType: "image/webp", ext: "webp" },
  tif: { mediaType: "image/tiff", ext: "tiff" },
  tiff: { mediaType: "image/tiff", ext: "tiff" },
};

// Turns an uploaded file into the manifest of SPEC §10.6, in the browser (SPEC §9.4 처리 구조).
// Returns null for formats that are not extracted yet (DOCX, XLSX, PPTX).
export async function extractManifest(file: File, context: ExtractContext): Promise<Extraction | null> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return extractPdf(file, context);
  if (extension in TEXT_TYPES) return { manifest: await extractText(file, TEXT_TYPES[extension], context), files: [] };
  if (extension in PICTURE_TYPES) return extractImage(file, PICTURE_TYPES[extension].mediaType, PICTURE_TYPES[extension].ext, context);
  return null;
}
