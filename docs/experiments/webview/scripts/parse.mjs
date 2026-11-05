#!/usr/bin/env node
/**
 * parse.mjs — zero-dependency EPUB (and .html/.md/.txt) parser.
 *
 *   node parse.mjs <input file> <out dir>
 *
 * Writes:
 *   <out>/parsed.json    – metadata + ordered chapters {id, href, title, html, text, wordCount}
 *   <out>/baseline.html  – deterministic WebView page built straight from the parser
 *                          (no AI): original markup kept, CSS + images inlined.
 *   <out>/images/…       – extracted images (also inlined as data: URIs in baseline.html)
 *
 * Node >= 18, no npm packages (zip is read with zlib.inflateRawSync).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// ------------------------------------------------------------------ zip
function readZip(buf) {
  // Locate End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a zip file (EOCD not found)");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("Bad central directory");
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nlen).toString("utf8");
    entries.set(name, { method, csize, usize, lho });
    off += 46 + nlen + elen + clen;
  }
  const read = (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const nlen = buf.readUInt16LE(e.lho + 26);
    const elen = buf.readUInt16LE(e.lho + 28);
    const start = e.lho + 30 + nlen + elen;
    const data = buf.subarray(start, start + e.csize);
    if (e.method === 0) return Buffer.from(data);
    if (e.method === 8) return zlib.inflateRawSync(data);
    throw new Error(`Unsupported zip method ${e.method} for ${name}`);
  };
  return { names: [...entries.keys()], read };
}

// ------------------------------------------------------------------ tiny xml helpers
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3]) : null;
};
const NAMED = { lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…", middot: "·", times: "×", copy: "©", laquo: "«", raquo: "»", bull: "•", ensp: " ", emsp: " ", thinsp: " ", shy: "" };
const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : m))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const stripTags = (html) =>
  decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr|figcaption)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
const resolveHref = (base, href) => {
  const clean = href.split("#")[0];
  const parts = (path.posix.dirname(base) + "/" + clean).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
};
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp" };

// ------------------------------------------------------------------ epub
function parseEpub(buf) {
  const zip = readZip(buf);
  const container = zip.read("META-INF/container.xml")?.toString("utf8");
  if (!container) throw new Error("No META-INF/container.xml");
  const opfPath = attr(container.match(/<rootfile\s[^>]*>/i)[0], "full-path");
  const opf = zip.read(opfPath).toString("utf8");
  const opfDir = path.posix.dirname(opfPath);
  const rel = (href) => (opfDir === "." ? href : resolveHref(opfPath, href));

  const meta = {};
  for (const tag of ["title", "creator", "language", "publisher", "date", "description"]) {
    const m = opf.match(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, "i"));
    if (m) meta[tag] = decodeEntities(m[1].trim());
  }

  const manifest = new Map();
  for (const item of opf.match(/<item\b[^>]*>/gi) ?? []) {
    manifest.set(attr(item, "id"), { href: rel(attr(item, "href")), type: attr(item, "media-type") ?? "", props: attr(item, "properties") ?? "" });
  }
  const spine = (opf.match(/<itemref\b[^>]*>/gi) ?? []).map((t) => attr(t, "idref")).filter((id) => manifest.has(id));

  // Table of contents titles (EPUB3 nav or NCX) → href → title
  const tocTitles = new Map();
  const navItem = [...manifest.values()].find((m) => m.props.includes("nav"));
  const ncxItem = [...manifest.values()].find((m) => m.type === "application/x-dtbncx+xml");
  if (navItem && zip.names.includes(navItem.href)) {
    const nav = zip.read(navItem.href).toString("utf8");
    for (const a of nav.match(/<a\b[^>]*href=[^>]*>[\s\S]*?<\/a>/gi) ?? []) {
      const href = attr(a, "href");
      if (href) tocTitles.set(resolveHref(navItem.href, href), stripTags(a));
    }
  } else if (ncxItem && zip.names.includes(ncxItem.href)) {
    const ncx = zip.read(ncxItem.href).toString("utf8");
    for (const np of ncx.match(/<navPoint\b[\s\S]*?<\/navPoint>/gi) ?? []) {
      const label = np.match(/<text>([\s\S]*?)<\/text>/i)?.[1];
      const src = np.match(/<content\b[^>]*>/i)?.[0];
      if (label && src) tocTitles.set(resolveHref(ncxItem.href, attr(src, "src")), decodeEntities(label.trim()));
    }
  }

  const cssCache = new Map();
  const images = [];
  const chapters = [];
  for (const id of spine) {
    const { href, type } = manifest.get(id);
    if (!/xhtml|html/.test(type) || !zip.names.includes(href)) continue;
    const raw = zip.read(href).toString("utf8");
    const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    let html = bodyMatch ? bodyMatch[1] : raw;

    // linked stylesheets → collected once, scoped later
    const css = [];
    for (const link of raw.match(/<link\b[^>]*>/gi) ?? []) {
      if (!/stylesheet/i.test(attr(link, "rel") ?? "")) continue;
      const cssHref = resolveHref(href, attr(link, "href") ?? "");
      if (!cssCache.has(cssHref) && zip.names.includes(cssHref)) cssCache.set(cssHref, zip.read(cssHref).toString("utf8"));
      if (cssCache.has(cssHref)) css.push(cssHref);
    }
    for (const style of raw.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []) css.push({ inline: style.replace(/<\/?style[^>]*>/gi, "") });

    // images → data URIs (keeps baseline self-contained for a WebView)
    html = html.replace(/<(img|image)\b([^>]*)>/gi, (tag, el, attrs) => {
      const src = attr(tag, "src") ?? attr(tag, "xlink:href") ?? attr(tag, "href");
      if (!src || src.startsWith("data:")) return tag;
      const file = resolveHref(href, src);
      if (!zip.names.includes(file)) return tag;
      const bytes = zip.read(file);
      const mime = MIME[path.posix.extname(file).toLowerCase()] ?? "application/octet-stream";
      images.push({ file, bytes, mime, chapter: id });
      const dataUri = `data:${mime};base64,${bytes.toString("base64")}`;
      return `<img${attrs.replace(/\s(src|xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/i, "")} src="${dataUri}" data-original-src="${src}">`;
    });

    const h1 = html.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
    const title = tocTitles.get(href) ?? (h1 ? stripTags(h1) : null) ?? raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? id;
    const text = stripTags(html);
    chapters.push({ id, href, title, html: html.trim(), css, text, wordCount: text.split(/\s+/).filter(Boolean).length });
  }
  return { format: "epub", meta, chapters, images, css: Object.fromEntries(cssCache) };
}

// ------------------------------------------------------------------ plain html / md / txt
function parseLoose(buf, ext) {
  const s = buf.toString("utf8");
  if (ext === ".html" || ext === ".htm" || ext === ".xhtml") {
    const body = s.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? s;
    const title = s.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "document";
    return { format: "html", meta: { title }, chapters: [{ id: "doc", href: "", title, html: body, css: [], text: stripTags(body), wordCount: stripTags(body).split(/\s+/).length }], images: [], css: {} };
  }
  // markdown / txt: split on headings; keep as <pre>-ish paragraphs
  const blocks = s.split(/\n(?=#{1,3}\s)/);
  const chapters = blocks.map((b, i) => {
    const title = b.match(/^#{1,3}\s+(.*)$/m)?.[1]?.trim() ?? `section-${i + 1}`;
    const html = b
      .split(/\n{2,}/)
      .map((p) => (p.match(/^#{1,3}\s+/) ? `<h2>${p.replace(/^#{1,3}\s+/, "")}</h2>` : `<p>${p.replace(/\n/g, "<br>")}</p>`))
      .join("\n");
    const text = stripTags(html);
    return { id: `s${i + 1}`, href: "", title, html, css: [], text, wordCount: text.split(/\s+/).length };
  });
  return { format: ext.slice(1), meta: { title: chapters[0]?.title ?? "document" }, chapters, images: [], css: {} };
}

// ------------------------------------------------------------------ baseline renderer
function baselineHtml(doc) {
  const scopedCss = Object.entries(doc.css)
    .map(([file, css]) => `/* ${file} */\n${css.replace(/@page[^{]*\{[^}]*\}/g, "").replace(/url\(([^)]+)\)/g, "url(about:blank)")}`)
    .join("\n");
  const inlineCss = doc.chapters.flatMap((c) => c.css.filter((x) => typeof x === "object").map((x) => x.inline)).join("\n");
  const body = doc.chapters
    .map((c) => `<section class="chapter" id="${c.id}" data-href="${c.href}">\n<h2 class="chapter-title">${c.title}</h2>\n${c.html}\n</section>`)
    .join("\n<hr class=\"chapter-break\">\n");
  return `<!doctype html>
<html lang="${doc.meta.language ?? "ko"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${doc.meta.title ?? "document"}</title>
<style>
:root { color-scheme: light; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; }
body { font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", Roboto, sans-serif; font-size: 17px; line-height: 1.75; word-break: keep-all; }
.chapter { padding: 24px 20px; max-width: 720px; margin: 0 auto; }
.chapter img, .chapter svg { max-width: 100%; height: auto; }
.chapter-title { font-size: 1.25em; margin: 0 0 1em; }
.chapter-break { border: 0; border-top: 1px solid #ddd; margin: 0; }
/* ---- original stylesheet(s) from the ebook, scoped ---- */
${scopedCss}
${inlineCss}
</style>
</head>
<body>
<header class="chapter"><h1>${doc.meta.title ?? ""}</h1>${doc.meta.creator ? `<p>${doc.meta.creator}</p>` : ""}</header>
${body}
</body>
</html>`;
}

// ------------------------------------------------------------------ api
export function parseFile(input) {
  const buf = fs.readFileSync(input);
  const ext = path.extname(input).toLowerCase();
  return ext === ".epub" ? parseEpub(buf) : parseLoose(buf, ext);
}

export function writeOutputs(doc, input, outDir) {
  fs.mkdirSync(path.join(outDir, "images"), { recursive: true });
  for (const im of doc.images) fs.writeFileSync(path.join(outDir, "images", path.posix.basename(im.file)), im.bytes);
  fs.writeFileSync(path.join(outDir, "baseline.html"), baselineHtml(doc));
  const json = {
    source: path.basename(input),
    format: doc.format,
    meta: doc.meta,
    css: Object.keys(doc.css),
    images: doc.images.map((i) => ({ file: i.file, mime: i.mime, bytes: i.bytes.length, chapter: i.chapter })),
    chapters: doc.chapters.map((c) => ({ ...c, css: c.css.map((x) => (typeof x === "string" ? x : "<inline>")) })),
  };
  fs.writeFileSync(path.join(outDir, "parsed.json"), JSON.stringify(json, null, 2));
  return json;
}

export { stripTags, baselineHtml };

// ------------------------------------------------------------------ main
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [input, outDir] = process.argv.slice(2);
  if (!input || !outDir) {
    console.error("usage: node parse.mjs <file.epub|.html|.md|.txt> <out dir>");
    process.exit(1);
  }
  const doc = parseFile(input);
  writeOutputs(doc, input, outDir);
  const totalWords = doc.chapters.reduce((n, c) => n + c.wordCount, 0);
  console.log(`[parse] ${path.basename(input)} → ${doc.chapters.length} chapters, ${totalWords} words, ${doc.images.length} images, ${Object.keys(doc.css).length} stylesheets → ${outDir}/`);
}
