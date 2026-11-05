import { extractPdf } from "./pdf";
import { extractText } from "./text";
import type { ExtractContext, Manifest } from "./manifest";

export type { Manifest } from "./manifest";

const TEXT_TYPES: Record<string, string> = { txt: "text/plain", md: "text/markdown" };

// Turns an uploaded file into the manifest of SPEC §10.6, in the browser (SPEC §9.4 처리 구조).
// Returns null for formats that are not extracted yet (DOCX, XLSX, PPTX, images).
export async function extractManifest(file: File, context: ExtractContext): Promise<Manifest | null> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return extractPdf(file, context);
  if (extension in TEXT_TYPES) return extractText(file, TEXT_TYPES[extension], context);
  return null;
}
