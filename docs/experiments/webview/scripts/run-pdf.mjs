#!/usr/bin/env node
/**
 * run-pdf.mjs — Gemini passes for the PDF e-book (hirst-ebook.pdf), using the data the
 * parser already extracted (pdf/pages.json + pdf/png/*.png + segments.json).
 *
 *   node run-pdf.mjs <pdf extract dir> <segments.json> <results dir> [--model gemini-2.5-flash] [--pages 1-5,13]
 *
 * Passes (all with the "verbatim, never rewrite" system instruction):
 *   A  structure   per page: text lines (with y / size) → JSON blocks with roles (title/heading/body/toc/footer/caption)
 *                  → "can Gemini replace the hand-written parser rules?"
 *   B  reflow      per section: the parser's segments → one responsive HTML section
 *                  → "Gemini writes the reading page from clean text"
 *   C  layout      per page: the page PNG (vision) + the same text lines → a 420×595 HTML page that
 *                  reproduces the layout with CSS → "can Gemini rebuild the original look?"
 * Text fidelity is measured here; the visual comparison of C is done afterwards against the PDF raster.
 */
import fs from "node:fs";
import path from "node:path";
import { readKey, endpointFor, gemini, SYSTEM, fidelity, stripJsonFence } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [EXT, SEGPATH, RESULTS] = pos;
if (!EXT || !SEGPATH || !RESULTS) {
  console.error("usage: node run-pdf.mjs <pdf extract dir> <segments.json> <results dir> [--model m] [--pages 1-5,13] [--skip A,B,C]");
  process.exit(1);
}
const MODEL = flag("--model", "gemini-2.5-flash");
const SKIP = new Set((flag("--skip", "") || "").split(",").filter(Boolean));
const DUMP = args.includes("--dump");          // write request payloads to <results>/requests/*.json
const DRY = args.includes("--dry");            // with --dump: do not call Gemini at all
const KEY = readKey();
if (!KEY) { console.error("GEMINI_KEY missing (.key file or env)"); process.exit(1); }
const ENDPOINT = endpointFor(KEY, MODEL);
let dumpN = 0;
const call = async (parts, opts) => {
  if (DUMP) {
    const body = { contents: [{ role: "user", parts: typeof parts === "string" ? [{ text: parts }] : parts }],
      systemInstruction: opts?.system ? { parts: [{ text: opts.system }] } : undefined,
      generationConfig: { temperature: opts?.temperature ?? 0, maxOutputTokens: 65536, ...(opts?.json ? { responseMimeType: "application/json" } : {}) } };
    const slim = JSON.parse(JSON.stringify(body, (k, v) => (k === "data" && typeof v === "string" && v.length > 200 ? `<base64 png, ${v.length} chars omitted>` : v)));
    fs.mkdirSync(path.join(RESULTS, "requests"), { recursive: true });
    fs.writeFileSync(path.join(RESULTS, "requests", `${String(++dumpN).padStart(2, "0")}-${opts?.label ?? "call"}.json`), JSON.stringify({ endpoint: ENDPOINT.replace(/key=.*/, "key=<GEMINI_KEY>"), body: slim }, null, 2));
    if (DRY) return { text: opts?.json ? "{}" : "", usage: {}, finish: "DRY", ms: 0 };
  }
  return gemini(ENDPOINT, parts, opts);
};

const pagesAll = JSON.parse(fs.readFileSync(path.join(EXT, "pages.json"), "utf8")).pages;
const wanted = new Set();
for (const tok of (flag("--pages", "") || "").split(",").filter(Boolean)) {
  const [a, b] = tok.split("-").map(Number);
  for (let n = a; n <= (b ?? a); n++) wanted.add(n);
}
const pages = wanted.size ? pagesAll.filter((p) => wanted.has(p.n)) : pagesAll;
const SEG = JSON.parse(fs.readFileSync(SEGPATH, "utf8"));
fs.mkdirSync(RESULTS, { recursive: true });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linesBlock = (pg) => pg.lines.map((l, i) => `${String(i + 1).padStart(3)} | y=${Math.round(l.y)} x=${Math.round(l.x)} size=${l.size}${l.bold ? " bold" : ""} | ${l.text}`).join("\n");
const pageText = (pg) => pg.lines.map((l) => l.text).join("\n");
const metrics = { model: MODEL, A: [], B: [], C: [], errors: [] };
const log = (s) => console.log(s);

// ---------------------------------------------------------------- A: structure
if (!SKIP.has("A")) {
  const outA = [];
  for (const pg of pages) {
    const prompt = `This is page ${pg.n} of ${pagesAll.length} of an exhibition guide e-book (A5, ${pg.w}×${pg.h} pt). Below are its text lines in reading order, with y position (pt from top), x, and font size.

Group the lines into blocks and label each block. Return JSON:
{"page": ${pg.n}, "blocks": [{"role": "title|heading|subheading|body|toc|caption|footer|pagenum|other", "lines": [line numbers], "text": "<the lines joined exactly as printed, in order>"}]}

Rules:
- "text" must be the verbatim concatenation of those lines. A line that ends mid-word was a wrapped word: join with no space. A line that ends with a space was a word break: keep the space. Never add, drop, reorder, or fix characters.
- Running footers (same tiny text on every page) → role "footer". Page numbers → "pagenum".
- Keep the source language (Korean). No commentary.

LINES:
${linesBlock(pg)}`;
    try {
      const r = await call(prompt, { json: true, system: SYSTEM, label: `A-structure-p${pg.n}` });
      const st = JSON.parse(stripJsonFence(r.text));
      outA.push(st);
      const got = (st.blocks ?? []).map((b) => b.text ?? "").join("\n");
      const f = fidelity(pageText(pg), got);
      metrics.A.push({ page: pg.n, ms: r.ms, tokens: r.usage, blocks: (st.blocks ?? []).length, roles: (st.blocks ?? []).map((b) => b.role), ...f });
      log(`A p${pg.n}: ${r.ms}ms charSim ${f.charSimilarity} sentCov ${f.sentenceCoverage} roles ${[...new Set((st.blocks ?? []).map((b) => b.role))].join("/")}`);
    } catch (e) { metrics.errors.push({ pass: "A", page: pg.n, error: e.message }); log(`A p${pg.n}: ERROR ${e.message.slice(0, 160)}`); }
  }
  fs.writeFileSync(path.join(RESULTS, "A-structure.json"), JSON.stringify(outA, null, 2));
}

// ---------------------------------------------------------------- B: reflow from segments
if (!SKIP.has("B")) {
  // chunk segments by h1/h2 sections
  const sections = [];
  let cur = { title: "(front)", segs: [] };
  for (const s of SEG.segments) {
    if (s.role === "h1" || s.role === "h2") { if (cur.segs.length) sections.push(cur); cur = { title: s.text, segs: [s] }; }
    else cur.segs.push(s);
  }
  if (cur.segs.length) sections.push(cur);
  const html = [];
  for (const sec of sections) {
    const src = sec.segs.map((s) => `[${s.role}] ${s.text}`).join("\n\n");
    const prompt = `Write ONE <section> of a mobile reading page for this part of an exhibition guide.

Rules:
- Output only the <section>…</section> fragment. No <html>/<head>/<body>, no markdown fences, no explanations.
- Reproduce ALL text verbatim in order. Do not paraphrase, shorten, translate, or add words. Keep Korean.
- Map roles: [h1]/[h2] → h2/h3, [body] → p, [small] → p class="small", [display] → p class="display", [h3] → h4.
- Wrap each body sentence in <span class="s"> (split only at sentence ends: . ? !). No inline styles.

SOURCE:
${src}`;
    try {
      const r = await call(prompt, { system: SYSTEM, label: `B-reflow-${sections.indexOf(sec) + 1}` });
      const frag = stripJsonFence(r.text);
      html.push(frag);
      const f = fidelity(sec.segs.map((s) => s.text).join("\n"), frag.replace(/<[^>]+>/g, " "));
      metrics.B.push({ section: sec.title, ms: r.ms, tokens: r.usage, ...f });
      log(`B ${sec.title.slice(0, 20)}: ${r.ms}ms charSim ${f.charSimilarity} sentCov ${f.sentenceCoverage}`);
    } catch (e) { metrics.errors.push({ pass: "B", section: sec.title, error: e.message }); log(`B ${sec.title.slice(0, 20)}: ERROR ${e.message.slice(0, 160)}`); }
  }
  fs.writeFileSync(path.join(RESULTS, "B-reflow.html"), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B · Gemini reflow</title>
<style>body{margin:0;padding:32px 20px 80px;max-width:680px;margin:0 auto;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif;font-size:17px;line-height:2;word-break:keep-all;color:#000;background:#fff}.display{font-size:2.6em;line-height:1.3;font-weight:700}h2{font-size:1.9em;line-height:1.3;font-weight:500;border-bottom:1px solid #000;padding-bottom:.4em;margin:2.5em 0 1.2em}h3{font-size:1.4em;font-weight:500;margin:2em 0 .8em}.small{font-size:.7em;color:#444;line-height:1.5}p{margin:0 0 1em}</style></head><body>${html.join("\n")}</body></html>`);
}

// ---------------------------------------------------------------- C: layout with vision
if (!SKIP.has("C")) {
  const pagesHtml = [];
  for (const pg of pages) {
    const png = fs.readFileSync(path.join(EXT, "png", `p${String(pg.n).padStart(2, "0")}.png`)).toString("base64");
    const prompt = `You are given an image of one A5 page (${pg.w}×${pg.h} pt) from an exhibition guide e-book, plus its text lines with positions.
Rebuild this page as HTML + CSS so that it looks as close as possible to the image when rendered in a ${pg.w}×${pg.h} px box.

Rules:
- Output only one <div class="page" style="position:relative;width:${pg.w}px;height:${pg.h}px;overflow:hidden;background:#fff">…</div>. No markdown fences, no explanation.
- Use the text EXACTLY as given in the lines (verbatim, same line breaks). Every line must appear once. Do not add text that is not in the lines (e.g. do not type what you see if it is not listed).
- Position elements with absolute coordinates (px = pt here). Reproduce rules/lines, font sizes, weights, and the running footer. Font-family: 'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif.
- Korean text must not be re-wrapped: use white-space:pre on each line or one element per line.

LINES:
${linesBlock(pg)}`;
    try {
      const r = await call([{ inlineData: { mimeType: "image/png", data: png } }, { text: prompt }], { system: SYSTEM, label: `C-layout-p${pg.n}` });
      const frag = stripJsonFence(r.text);
      pagesHtml.push(frag);
      const f = fidelity(pageText(pg), frag.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "\n"));
      metrics.C.push({ page: pg.n, ms: r.ms, tokens: r.usage, ...f });
      log(`C p${pg.n}: ${r.ms}ms charSim ${f.charSimilarity} sentCov ${f.sentenceCoverage}`);
    } catch (e) { metrics.errors.push({ pass: "C", page: pg.n, error: e.message }); pagesHtml.push(`<div class="page" data-page="${pg.n}"><!-- C failed --></div>`); log(`C p${pg.n}: ERROR ${e.message.slice(0, 160)}`); }
  }
  fs.writeFileSync(path.join(RESULTS, "C-layout.html"), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C · Gemini layout</title>
<style>html,body{margin:0;background:#e9e9e9}.sheet{width:420px;margin:0 auto}.page{margin:16px auto;box-shadow:0 1px 6px rgba(0,0,0,.15)}</style></head><body><div class="sheet">${pagesHtml.join("\n")}</div></body></html>`);
}

fs.writeFileSync(path.join(RESULTS, "metrics.json"), JSON.stringify(metrics, null, 2));
const avg = (arr, k) => (arr.length ? (arr.reduce((n, x) => n + (x[k] ?? 0), 0) / arr.length).toFixed(3) : "-");
const tok = (arr) => arr.reduce((n, x) => n + (x.tokens?.promptTokenCount ?? 0), 0) + " in / " + arr.reduce((n, x) => n + (x.tokens?.candidatesTokenCount ?? 0), 0) + " out";
const ms = (arr) => arr.reduce((n, x) => n + x.ms, 0);
const lines = [
  `# PDF e-book → Gemini passes (${MODEL})`, ``,
  `| pass | units | charSim | sentence coverage | tokens | time |`, `| --- | --- | --- | --- | --- | --- |`,
  `| A structure (lines → JSON roles) | ${metrics.A.length} pages | ${avg(metrics.A, "charSimilarity")} | ${avg(metrics.A, "sentenceCoverage")} | ${tok(metrics.A)} | ${ms(metrics.A)} ms |`,
  `| B reflow (segments → HTML) | ${metrics.B.length} sections | ${avg(metrics.B, "charSimilarity")} | ${avg(metrics.B, "sentenceCoverage")} | ${tok(metrics.B)} | ${ms(metrics.B)} ms |`,
  `| C layout (image + lines → page HTML) | ${metrics.C.length} pages | ${avg(metrics.C, "charSimilarity")} | ${avg(metrics.C, "sentenceCoverage")} | ${tok(metrics.C)} | ${ms(metrics.C)} ms |`, ``,
];
for (const p of ["A", "B", "C"]) {
  const miss = metrics[p].flatMap((m) => (m.missingSentences ?? []).map((s) => `${p}/${m.page ?? m.section}: ${s}`)).slice(0, 10);
  const add = metrics[p].flatMap((m) => (m.addedSentences ?? []).map((s) => `${p}/${m.page ?? m.section}: ${s}`)).slice(0, 10);
  if (miss.length) lines.push(`**${p} missing (first ${miss.length})**`, ...miss.map((s) => `- ${s.slice(0, 160)}`), ``);
  if (add.length) lines.push(`**${p} added/altered (first ${add.length})**`, ...add.map((s) => `- ${s.slice(0, 160)}`), ``);
}
if (metrics.errors.length) lines.push(`errors: ${metrics.errors.map((e) => `${e.pass}/${e.page ?? e.section}: ${e.error.slice(0, 100)}`).join("; ")}`);
fs.writeFileSync(path.join(RESULTS, "report.md"), lines.join("\n"));
console.log(`\nreport → ${path.join(RESULTS, "report.md")}`);
