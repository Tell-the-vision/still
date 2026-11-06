// lib.mjs — shared: Gemini call (Vertex express / AI Studio), fidelity metrics.
import fs from "node:fs";
import path from "node:path";

export function readKey() {
  if (process.env.GEMINI_KEY) return process.env.GEMINI_KEY;
  for (const f of [".key", path.join(path.dirname(new URL(import.meta.url).pathname), ".key")]) {
    try {
      const m = fs.readFileSync(f, "utf8").match(/GEMINI_KEY\s*=\s*(\S+)/);
      if (m) return m[1];
    } catch {}
  }
  return "";
}
export function endpointFor(key, model) {
  if (process.env.GEMINI_ENDPOINT) return process.env.GEMINI_ENDPOINT;
  // GEMINI_API=ais forces the AI Studio endpoint (generativelanguage), =vertex forces Vertex.
  // Otherwise: Vertex AI express-mode keys start with "AQ."; AI Studio keys start with "AIza".
  const api = (process.env.GEMINI_API || "").toLowerCase();
  const useVertex = api === "vertex" ? true : api === "ais" ? false : key.startsWith("AQ.");
  return useVertex
    ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${key}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
}

/** parts: string | [{text}|{inlineData:{mimeType,data}}] */
export async function gemini(endpoint, parts, { json = false, system = "", temperature = 0 } = {}) {
  const body = {
    contents: [{ role: "user", parts: typeof parts === "string" ? [{ text: parts }] : parts }],
    generationConfig: { temperature, maxOutputTokens: 65536, ...(json ? { responseMimeType: "application/json" } : {}) },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const t0 = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return { text: out, usage: data.usageMetadata ?? {}, finish: data.candidates?.[0]?.finishReason, ms: Date.now() - t0 };
    }
    lastErr = `${res.status} ${text.slice(0, 300)}`;
    if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 2000 * attempt));
    else break;
  }
  throw new Error(`Gemini call failed: ${lastErr}`);
}

export const SYSTEM = `You are a conversion engine, not a writer. You never paraphrase, summarise, translate, correct, or add text. Every character of the author's text must be reproduced exactly as given (same wording, punctuation, line order). Output only the requested format.`;

export const stripJsonFence = (t) => t.replace(/^```(?:json|html)?\s*/i, "").replace(/```\s*$/, "").trim();

// ------------------------------------------------------------------ fidelity
export const norm = (s) =>
  s
    .normalize("NFC")
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
export const sentencesOf = (text) =>
  text
    .normalize("NFC")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?。！？])\s+/))
    .map((s) => norm(s))
    .filter((s) => s.length >= 2);

function levenshteinRatio(a, b) {
  // character-level similarity; falls back to token level for long texts
  if (a.length * b.length > 4_000_000) {
    const A = a.split(" "), B = b.split(" ");
    return 1 - lev(A, B) / Math.max(A.length, B.length, 1);
  }
  return 1 - lev([...a], [...b]) / Math.max(a.length, b.length, 1);
}
function lev(a, b) {
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function fidelity(originalText, candidateText) {
  const o = norm(originalText), c = norm(candidateText);
  const os = sentencesOf(originalText), cs = sentencesOf(candidateText);
  const cset = new Set(cs), oset = new Set(os);
  const missing = os.filter((s) => !cset.has(s) && !c.includes(s));
  const added = cs.filter((s) => !oset.has(s) && !o.includes(s));
  return {
    charSimilarity: Number(levenshteinRatio(o, c).toFixed(4)),
    originalSentences: os.length,
    sentenceCoverage: Number(((os.length - missing.length) / Math.max(os.length, 1)).toFixed(4)),
    missingSentences: missing.slice(0, 20),
    addedSentences: added.slice(0, 20),
    originalChars: o.length,
    candidateChars: c.length,
  };
}

