import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PDFPageProxy } from "pdfjs-dist";
import { finish, normaliseSpaces, type Bbox, type ExtractContext, type Extraction, type Manifest, type ManifestAsset, type RawSegment } from "./manifest";

// A PDF with a text layer: one segment per line of text, top to bottom on each page (SPEC §9.4 추출), and the
// images drawn on its pages (SPEC §10.6 assets, kind EMBEDDED), each saved as a JPEG.
// Text far apart on one baseline (two columns, the cells of a table row) becomes separate segments, read left to
// right line by line. Spreads, repeated headers and overlapping layers are not handled yet.

// Smaller images are rules, logos and ornaments, not artworks.
const MIN_IMAGE_SIDE = 64;

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray; kind?: number };

// The decoded image pdf.js keeps for an operator argument (page-level, or shared when its name starts with "g_").
function imageObject(page: PDFPageProxy, name: string): Promise<PdfImage | null> {
  const store = name.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    try { store.get(name, (img: PdfImage | null) => resolve(img)); } catch { resolve(null); }
  });
}

// pdf.js image data is grey (1 bit), RGB or RGBA; a canvas wants RGBA.
function toCanvas(img: PdfImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const rgba = new Uint8ClampedArray(img.width * img.height * 4);
    const pixels = img.width * img.height;
    if (img.kind === 3) rgba.set(img.data);
    else if (img.kind === 2) for (let i = 0; i < pixels; i++) { rgba[i * 4] = img.data[i * 3]; rgba[i * 4 + 1] = img.data[i * 3 + 1]; rgba[i * 4 + 2] = img.data[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    else {
      const rowBytes = Math.ceil(img.width / 8);
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const on = (img.data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = on ? 255 : 0, i = (y * img.width + x) * 4;
        rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
      }
    }
    ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  }
  return canvas;
}

const sha256Hex = async (blob: Blob) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");

type Found = { page: number; bbox: Bbox; img: PdfImage };

// The images painted on one page, with where they sit (top-left origin, like the segments' bboxes).
async function pageImages(pdfjs: typeof import("pdfjs-dist"), page: PDFPageProxy, number: number): Promise<Found[]> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const [x0, y0, , y1] = page.view;
  const height = y1 - y0;
  const found: Found[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    if (fn === pdfjs.OPS.save) stack.push(ctm);
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === pdfjs.OPS.transform) ctm = multiply(ctm, argsArray[i] as Matrix);
    else if (fn === pdfjs.OPS.paintImageXObject) {
      const img = await imageObject(page, argsArray[i][0] as string);
      if (!img || img.width < MIN_IMAGE_SIDE || img.height < MIN_IMAGE_SIDE) continue;
      // The image fills the unit square under the current matrix.
      const xs = [ctm[4], ctm[4] + ctm[0] + ctm[2]], ys = [ctm[5], ctm[5] + ctm[1] + ctm[3]];
      const bbox: Bbox = [round(Math.min(...xs) - x0), round(height - (Math.max(...ys) - y0)), round(Math.max(...xs) - x0), round(height - (Math.min(...ys) - y0))];
      found.push({ page: number, bbox, img });
    }
  }
  return found;
}

// Each image found becomes asset a01, a02, …: the image as assets/aNN.jpg and the copy shown to people as
// assets/aNN.display.webp (the names the server accepts, SPEC §10.6).
async function toAssets(found: Found[]): Promise<{ assets: ManifestAsset[]; files: Extraction["files"] }> {
  const assets: ManifestAsset[] = [];
  const files: Extraction["files"] = [];
  for (const [n, { page, bbox, img }] of found.entries()) {
    const canvas = toCanvas(img);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    const [object, display] = await Promise.all([encode("image/jpeg"), encode("image/webp")]);
    if (!object || !display) continue;
    const id = `a${String(n + 1).padStart(2, "0")}`;
    const objectName = `assets/${id}.jpg`;
    const displayName = `assets/${id}.display.webp`;
    assets.push({ id, kind: "EMBEDDED", object: objectName, display: displayName, format: "image/jpeg", pixels: [img.width, img.height], sha256: await sha256Hex(object), placements: [{ page, bbox }] });
    files.push({ name: objectName, blob: object }, { name: displayName, blob: display });
  }
  return { assets, files };
}

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

// A gap wider than the line's font size starts a new segment: word spaces are a fraction of it, while a second
// column or the next table cell is further away.
function splitAtGaps(line: Line): Line[] {
  const parts: Line[] = [];
  let current: TextItem[] = [];
  let end: number | null = null;
  for (const item of line.items) {
    if (end !== null && item.transform[4] - end > line.size && current.length) {
      parts.push({ ...line, items: current });
      current = [];
    }
    current.push(item);
    end = item.transform[4] + item.width;
  }
  if (current.length) parts.push({ ...line, items: current });
  return parts;
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

export async function extractPdf(file: File, context: ExtractContext): Promise<Extraction> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const pages: Manifest["pages"] = [];
    const segments: RawSegment[] = [];
    const images: Found[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const [x0, y0, x1, y1] = page.view;
      const height = y1 - y0;
      pages.push({ page: number, size: [round(x1 - x0), round(height)] });

      images.push(...(await pageImages(pdfjs, page, number))); // reading the operators also loads the fonts named below
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => "str" in i && i.str !== "");
      const lines = groupLines(items).flatMap(splitAtGaps).map((line): RawSegment => {
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
    const { assets, files } = await toAssets(images);
    return { manifest: finish(context, "application/pdf", pages, segments, warnings, assets), files };
  } finally {
    await task.destroy();
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
