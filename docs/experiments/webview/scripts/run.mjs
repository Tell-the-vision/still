#!/usr/bin/env node
/**
 * run.mjs — EBOOK → WebView experiment: basic parser + Gemini calls, with a
 * fidelity check ("is the original text preserved?").
 *
 *   set GEMINI_KEY=...            (Windows cmd)   /  export GEMINI_KEY=... (bash)
 *   node run.mjs <samples dir or file> <results dir> [--model gemini-2.5-flash] [--no-gemini]
 *
 * For every sample it writes <results>/<name>/:
 *   parsed.json            parser output (chapters, text, images, css)
 *   baseline.html          WebView page from the parser only (ground truth, no AI)
 *   A-structure.json       Gemini pass A: structured blocks + verbatim sentence list
 *   A-structure.html       the same, rendered deterministically from that JSON
 *   B-render.html          Gemini pass B: Gemini writes the WebView HTML itself
 *   metrics.json           fidelity numbers for A and B against the parser text
 * and <results>/report.md with everything side by side.
 *
 * Zero npm dependencies. Node >= 18.
 */
import fs from "node:fs";
import path from "node:path";
import { parseFile, writeOutputs, stripTags } from "./parse.mjs";
import { readKey, endpointFor, gemini as geminiCall, SYSTEM, fidelity, stripJsonFence } from "./lib.mjs";

// ------------------------------------------------------------------ config
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const NO_GEMINI = args.includes("--no-gemini");
const MODEL = flag("--model", "gemini-2.5-flash");
const positional = args.filter((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--") || args[i - 1] === "--no-gemini"));
const [INPUT, RESULTS] = positional;
if (!INPUT || !RESULTS) {
  console.error("usage: node run.mjs <samples dir|file> <results dir> [--model gemini-2.5-flash] [--no-gemini]");
  process.exit(1);
}
const KEY = readKey();
if (!NO_GEMINI && !KEY) {
  console.error("GEMINI_KEY is not set (env var or a .key file with GEMINI_KEY=...). Use --no-gemini to run the parser only.");
  process.exit(1);
}
const ENDPOINT = endpointFor(KEY, MODEL);
const gemini = (prompt, opts) => geminiCall(ENDPOINT, prompt, opts);

const promptA = (chapter) => `Convert this ebook chapter into structured JSON for a mobile web page.

Rules:
- "blocks" lists every piece of content in reading order. Allowed "type": heading, paragraph, quote, caption, list, figure, other.
- "text" must be VERBATIM from the source (copy, do not rewrite). For "list" put each item verbatim into "items".
- For an image use type "figure" with "imageRef" = the data-original-src value (or alt) and "caption" verbatim if present.
- "sentences": every sentence of body text in order, verbatim, one string each (split only on sentence boundaries). Do not include headings or captions here.
- Keep the source language. Do not translate. Do not invent anything that is not in the source.

Return exactly: {"title": string, "blocks": [...], "sentences": [...]}

SOURCE HTML (images already inlined; use data-original-src for imageRef):
${chapter.html.replace(/src="data:[^"]+"/g, 'src="(inlined)"')}

SOURCE PLAIN TEXT (for reference):
${chapter.text}`;

const promptB = (doc, chapter, imgs) => `Write the HTML for ONE section of a mobile WebView page that shows this ebook chapter.

Rules:
- Output a single <section>…</section> fragment only (no <html>, <head>, <body>, no markdown fences, no explanations).
- Reproduce ALL text verbatim, in the original order. Do not paraphrase, shorten, translate, or add text. Keep the source language.
- Use semantic tags (h2, p, blockquote, figure/figcaption, ul/li). Inline styles are allowed but keep it minimal.
- For images write <img src="{{img:N}}" alt="..."> using the placeholders listed below; do not invent images.
- Typography: readable on a phone (line-height ≥ 1.7, no fixed widths).

Book: ${doc.meta.title ?? ""} ${doc.meta.creator ? "— " + doc.meta.creator : ""}
Chapter title: ${chapter.title}
Image placeholders: ${imgs.length ? imgs.map((im, i) => `{{img:${i + 1}}} = ${im.original}`).join(", ") : "(none)"}

SOURCE HTML:
${chapter.html.replace(/src="data:[^"]+"/g, 'src="(inlined)"')}`;

// ------------------------------------------------------------------ renderers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function renderFromStructure(doc, structs, imageMap) {
  const section = (st) =>
    `<section class="chapter">\n<h2>${esc(st.title ?? "")}</h2>\n` +
    (st.blocks ?? [])
      .map((b) => {
        switch (b.type) {
          case "heading": return `<h3>${esc(b.text ?? "")}</h3>`;
          case "quote": return `<blockquote><p>${esc(b.text ?? "")}</p></blockquote>`;
          case "caption": return `<p class="caption">${esc(b.text ?? "")}</p>`;
          case "list": return `<ul>${(b.items ?? []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
          case "figure": {
            const src = imageMap.get(b.imageRef) ?? imageMap.get(path.posix.basename(b.imageRef ?? "")) ?? "";
            return `<figure>${src ? `<img src="${src}" alt="">` : `<!-- missing image ${esc(b.imageRef ?? "")} -->`}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
          }
          default: return `<p>${esc(b.text ?? "")}</p>`;
        }
      })
      .join("\n") +
    `\n</section>`;
  return page(doc, structs.map(section).join("\n<hr>\n"));
}
const page = (doc, body) => `<!doctype html><html lang="${doc.meta.language ?? "ko"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.meta.title ?? "")}</title>
<style>body{margin:0;background:#fff;color:#111;font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:17px;line-height:1.75;word-break:keep-all}.chapter,section{padding:24px 20px;max-width:720px;margin:0 auto}img{max-width:100%;height:auto}.caption,figcaption{font-size:.85em;color:#666}hr{border:0;border-top:1px solid #ddd;margin:0}</style></head><body>${body}</body></html>`;

// ------------------------------------------------------------------ main
const samples = fs.statSync(INPUT).isDirectory()
  ? fs.readdirSync(INPUT).filter((f) => /\.(epub|html?|xhtml|md|txt)$/i.test(f)).map((f) => path.join(INPUT, f))
  : [INPUT];
if (!samples.length) {
  console.error(`No .epub/.html/.md/.txt files in ${INPUT}`);
  process.exit(1);
}
fs.mkdirSync(RESULTS, { recursive: true });
const report = [`# EBOOK → WebView experiment`, ``, `model: \`${MODEL}\` · endpoint: ${KEY.startsWith("AQ.") ? "Vertex AI express" : "AI Studio"} · ${new Date().toISOString()}`, ``];

for (const file of samples) {
  const name = path.basename(file).replace(/\.[^.]+$/, "");
  const out = path.join(RESULTS, name);
  console.log(`\n=== ${path.basename(file)}`);
  let doc;
  try {
    doc = parseFile(file);
  } catch (e) {
    console.error(`  parse failed: ${e.message}`);
    report.push(`## ${path.basename(file)}`, ``, `parse failed: ${e.message}`, ``);
    continue;
  }
  const parsed = writeOutputs(doc, file, out);
  const totalWords = doc.chapters.reduce((n, c) => n + c.wordCount, 0);
  console.log(`  parser: ${doc.chapters.length} chapters, ${totalWords} words, ${doc.images.length} images, ${Object.keys(doc.css).length} css`);
  report.push(`## ${path.basename(file)}`, ``, `- parser: ${doc.chapters.length} chapters · ${totalWords} words · ${doc.images.length} images · ${Object.keys(doc.css).length} stylesheets · baseline: \`${name}/baseline.html\``);
  if (NO_GEMINI) { report.push(``); continue; }

  const imageMap = new Map();
  for (const ch of doc.chapters) {
    for (const m of ch.html.matchAll(/<img[^>]*src="(data:[^"]+)"[^>]*data-original-src="([^"]+)"/g)) {
      imageMap.set(m[2], m[1]);
      imageMap.set(path.posix.basename(m[2]), m[1]);
    }
  }

  const metrics = { A: [], B: [], usage: { A: {}, B: {} }, errors: [] };
  const structs = [];
  const sectionsB = [];
  for (const ch of doc.chapters) {
    // ---- pass A: structure JSON
    try {
      const r = await gemini(promptA(ch), { json: true, system: SYSTEM });
      let st;
      try { st = JSON.parse(r.text); } catch { st = JSON.parse(r.text.replace(/^```json\s*|```\s*$/g, "")); }
      structs.push(st);
      const textA = [st.title, ...(st.blocks ?? []).flatMap((b) => [b.text, b.caption, ...(b.items ?? [])])].filter(Boolean).join("\n");
      const f = fidelity(ch.text, textA);
      const fs2 = fidelity(ch.text.split("\n").slice(1).join("\n"), (st.sentences ?? []).join(" "));
      metrics.A.push({ chapter: ch.id, title: ch.title, ms: r.ms, finish: r.finish, tokens: r.usage, blocks: (st.blocks ?? []).length, sentences: (st.sentences ?? []).length, ...f, sentenceListCoverage: fs2.sentenceCoverage });
      console.log(`  A ${ch.id}: ${r.ms}ms  charSim ${f.charSimilarity}  sentCov ${f.sentenceCoverage}  blocks ${(st.blocks ?? []).length}`);
    } catch (e) {
      metrics.errors.push({ pass: "A", chapter: ch.id, error: e.message });
      console.error(`  A ${ch.id}: ${e.message}`);
      structs.push({ title: ch.title, blocks: [], sentences: [] });
    }
    // ---- pass B: Gemini writes the HTML
    try {
      const imgs = [...ch.html.matchAll(/<img[^>]*src="(data:[^"]+)"[^>]*data-original-src="([^"]+)"/g)].map((m) => ({ data: m[1], original: m[2] }));
      const r = await gemini(promptB(doc, ch, imgs), { system: SYSTEM });
      let html = r.text.replace(/^```html?\s*|```\s*$/g, "").trim();
      html = html.replace(/\{\{img:(\d+)\}\}/g, (_, n) => imgs[Number(n) - 1]?.data ?? "");
      sectionsB.push(html);
      const f = fidelity(ch.text, stripTags(html));
      metrics.B.push({ chapter: ch.id, title: ch.title, ms: r.ms, finish: r.finish, tokens: r.usage, ...f });
      console.log(`  B ${ch.id}: ${r.ms}ms  charSim ${f.charSimilarity}  sentCov ${f.sentenceCoverage}`);
    } catch (e) {
      metrics.errors.push({ pass: "B", chapter: ch.id, error: e.message });
      console.error(`  B ${ch.id}: ${e.message}`);
      sectionsB.push(`<section><!-- pass B failed for ${ch.id} --></section>`);
    }
  }
  fs.writeFileSync(path.join(out, "A-structure.json"), JSON.stringify(structs, null, 2));
  fs.writeFileSync(path.join(out, "A-structure.html"), renderFromStructure(doc, structs, imageMap));
  fs.writeFileSync(path.join(out, "B-render.html"), page(doc, sectionsB.join("\n<hr>\n")));
  fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(metrics, null, 2));

  const avg = (arr, k) => (arr.length ? (arr.reduce((n, x) => n + (x[k] ?? 0), 0) / arr.length).toFixed(3) : "-");
  const sum = (arr, k) => arr.reduce((n, x) => n + (x.tokens?.[k] ?? 0), 0);
  report.push(
    `- **Pass A (structure JSON → deterministic HTML)**: charSim ${avg(metrics.A, "charSimilarity")} · sentence coverage ${avg(metrics.A, "sentenceCoverage")} · sentence-list coverage ${avg(metrics.A, "sentenceListCoverage")} · ${sum(metrics.A, "promptTokenCount")} in / ${sum(metrics.A, "candidatesTokenCount")} out tokens · ${metrics.A.reduce((n, x) => n + x.ms, 0)} ms`,
    `- **Pass B (Gemini writes HTML)**: charSim ${avg(metrics.B, "charSimilarity")} · sentence coverage ${avg(metrics.B, "sentenceCoverage")} · ${sum(metrics.B, "promptTokenCount")} in / ${sum(metrics.B, "candidatesTokenCount")} out tokens · ${metrics.B.reduce((n, x) => n + x.ms, 0)} ms`,
  );
  const miss = [...metrics.A.flatMap((m) => m.missingSentences.map((s) => `A/${m.chapter}: ${s}`)), ...metrics.B.flatMap((m) => m.missingSentences.map((s) => `B/${m.chapter}: ${s}`))].slice(0, 12);
  const add = [...metrics.A.flatMap((m) => m.addedSentences.map((s) => `A/${m.chapter}: ${s}`)), ...metrics.B.flatMap((m) => m.addedSentences.map((s) => `B/${m.chapter}: ${s}`))].slice(0, 12);
  if (miss.length) report.push(`- missing (first ${miss.length}):`, ...miss.map((s) => `  - ${s.slice(0, 160)}`));
  if (add.length) report.push(`- added / altered (first ${add.length}):`, ...add.map((s) => `  - ${s.slice(0, 160)}`));
  if (metrics.errors.length) report.push(`- errors: ${metrics.errors.map((e) => `${e.pass}/${e.chapter}: ${e.error.slice(0, 120)}`).join("; ")}`);
  report.push(``);
}
fs.writeFileSync(path.join(RESULTS, "report.md"), report.join("\n"));
console.log(`\nreport → ${path.join(RESULTS, "report.md")}`);
