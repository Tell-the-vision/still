import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { finish, normaliseSpaces, type Bbox, type ExtractContext, type Manifest, type RawSegment } from "./manifest";

// A PDF with a text layer: one segment per line of text, top to bottom on each page (SPEC §9.4 추출).
// Columns, spreads, repeated headers and overlapping layers are not handled yet.

// pdf.js is large; it loads only when a PDF is extracted. Its worker runs as a module worker.
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

type Line = { items: TextItem[]; y: number; size: number };

// Text items with (nearly) the same baseline form one line. Items of one line, left to right, are joined
// with a space only where the gap between them is wide enough to be one.
function groupLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of items) {
    const y = item.transform[5];
    const size = item.height || Math.abs(item.transform[3]);
    const line = lines.find((l) => Math.abs(l.y - y) < size * 0.4);
    if (line) line.items.push(item);
    else lines.push({ items: [item], y, size });
  }
  for (const line of lines) line.items.sort((a, b) => a.transform[4] - b.transform[4]);
  return lines.sort((a, b) => b.y - a.y); // PDF y grows upwards
}

function lineText({ items, size }: Line): string {
  let text = "";
  let end: number | null = null;
  for (const item of items) {
    const gap = end === null ? 0 : item.transform[4] - end;
    if (gap > size * 0.2 && !/\s$/.test(text) && !/^\s/.test(item.str)) text += " ";
    text += item.str;
    end = item.transform[4] + item.width;
  }
  return normaliseSpaces(text);
}

// A line that ends in a word fragment and a hyphen, followed by a line that starts in lower case, is one
// word split by the line break (SPEC §9.4 추출 allows rejoining it). The fragment's rest moves up to the first
// line, which keeps its bbox; a line left empty disappears. "state-" / "of-the-art" would be joined wrongly.
function rejoinHyphenated(lines: RawSegment[]): RawSegment[] {
  const out: RawSegment[] = [];
  for (const line of lines) {
    const previous = out.at(-1);
    if (previous && /\p{L}{2}-$/u.test(previous.text) && /^\p{Ll}/u.test(line.text)) {
      const [word, ...rest] = line.text.split(" ");
      previous.text = previous.text.slice(0, -1) + word;
      if (rest.length) out.push({ ...line, text: rest.join(" ") });
    } else {
      out.push({ ...line });
    }
  }
  return out;
}

export async function extractPdf(file: File, context: ExtractContext): Promise<Manifest> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const pages: Manifest["pages"] = [];
    const segments: RawSegment[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const [x0, y0, x1, y1] = page.view;
      const height = y1 - y0;
      pages.push({ page: number, size: [round(x1 - x0), round(height)] });

      await page.getOperatorList(); // loads the fonts, so that their real names are known below
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => "str" in i && i.str !== "");
      const lines = groupLines(items).map((line): RawSegment => {
        const first = line.items[0];
        const left = Math.min(...line.items.map((i) => i.transform[4]));
        const right = Math.max(...line.items.map((i) => i.transform[4] + i.width));
        const base = line.y - y0;
        const bbox: Bbox = [round(left - x0), round(height - base - line.size), round(right - x0), round(height - base)]; // top-left origin
        // Standard fonts that are not embedded have no name without pdf.js's font data files: font stays null.
        const fontName: string | null = page.commonObjs.has(first.fontName) ? (page.commonObjs.get(first.fontName)?.name ?? null) : null;
        return { page: number, bbox, text: lineText(line), font: fontName, size: round(line.size) };
      });
      segments.push(...rejoinHyphenated(lines.filter((l) => l.text !== "")));
    }
    const warnings = segments.length === 0 ? [{ code: "NO_TEXT_LAYER" }] : [];
    return finish(context, "application/pdf", pages, segments, warnings);
  } finally {
    await task.destroy();
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
