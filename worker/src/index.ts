import { structureRequest, structureResponse, type StructureRequest } from "../../shared/src/analysis-worker";
import { structureInput, structureOutput, type StructureInput } from "../../shared/src/analysis-structure";
import { SUGGEST_KINDS, suggestInput, suggestOutput, type SuggestInput } from "../../shared/src/analysis-suggest";
import { verifyWorkerRequest } from "../../shared/src/analysis-worker-signature";
import { CONTENT_KINDS } from "../../shared/src/console-content";
import { SECTION_KINDS } from "../../shared/src/console-draft";
import { z } from "zod";
import { IMAGE_DISPLAYS } from "../../shared/src/still-doc";

// Cloudflare Worker for institution-console analysis (SPEC §9.4 처리 구조, §10.10). It holds the Gemini
// key, groups source segments into content items and answers with references only. It never writes
// text: the only model-written string that can come back is an item's `label`.

export interface Env {
  GEMINI_KEY: string;
  ANALYSIS_WORKER_SECRET: string;
  GEMINI_MODEL_STRUCTURE?: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// SPEC §9.6 analysis failure codes, returned in the body as { error }.
type FailureCode = "INVALID_OUTPUT" | "LOCATION_DENIED" | "QUOTA" | "RESULT_TOO_LARGE" | "UPSTREAM";

const DEFAULT_MODEL = "gemini-2.5-flash";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const failure = (error: FailureCode, status = 502) => json({ error }, status);
// INVALID_OUTPUT with the first schema issues (paths and codes only, never source or model text), so a
// failed analysis says which rule the answer broke.
const invalidOutput = (error: z.ZodError) =>
  json({ error: "INVALID_OUTPUT", issues: error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), code: i.code })) }, 502);

const refs = { type: "ARRAY", items: { type: "STRING" } };
// Gemini's responseSchema has no free-form maps, so artwork fields are a list of { name, ref }.
const responseSchema = {
  type: "OBJECT",
  required: ["items", "outline"],
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["key", "kind", "blocks", "fields", "label"],
        properties: {
          key: { type: "STRING" },
          kind: { type: "STRING", enum: [...CONTENT_KINDS] },
          blocks: {
            type: "ARRAY",
            items: {
              anyOf: [
                { type: "OBJECT", required: ["type", "refs"], properties: { type: { type: "STRING", enum: ["heading", "paragraph", "sentence"] }, refs } },
                {
                  type: "OBJECT",
                  required: ["type", "asset", "display", "captionRefs"],
                  properties: {
                    type: { type: "STRING", enum: ["image"] },
                    asset: { type: "STRING" },
                    display: { type: "STRING", enum: ["HERO", "GALLERY", "INLINE", "PORTRAIT"] },
                    captionRefs: refs,
                  },
                },
              ],
            },
          },
          fields: { type: "ARRAY", items: { type: "OBJECT", required: ["name", "ref"], properties: { name: { type: "STRING" }, ref: { type: "STRING" } } } },
          label: { type: "STRING", nullable: true },
        },
      },
    },
    outline: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["section", "title", "items"],
        properties: { section: { type: "STRING", enum: [...SECTION_KINDS] }, title: { type: "STRING", nullable: true }, items: { type: "ARRAY", items: { type: "STRING" } } },
      },
    },
  },
};

function structurePrompt(request: StructureRequest): string {
  const segments = request.segments.map((s) => `${s.ref} [p${s.page}${s.role ? `, ${s.role}` : ""}${s.size ? `, size ${s.size}` : ""}] ${s.text}`);
  return [
    "You structure the text of a museum or gallery guide for visitors.",
    `Group the segments below into content items. Each item has one kind from: ${CONTENT_KINDS.join(", ")}.`,
    "Answer with segment references (like d1:s014, or d1:s015.3 for one sentence) and image asset references only.",
    "Never write, rewrite, translate or summarize text. Every block holds references; the text stays in the source.",
    "Use `label` only for a section or theme name that does not appear in the source; otherwise null.",
    "Keep the reading order of the source. For artwork items, put each field (title, artist, year, ...) in `fields` with the reference of the segment that holds its value.",
    "Summarise the section order of the guide in `outline`, listing item keys.",
    "",
    "Segments:",
    ...segments,
  ].join("\n");
}

type GeminiAnswer = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

// Failures of the call itself (not of the model's answer), mapped to SPEC §9.6 codes.
async function geminiFailure(response: Response): Promise<FailureCode> {
  if (response.status === 429) return "QUOTA";
  const message = await response.text();
  if (/location is not supported/i.test(message)) return "LOCATION_DENIED";
  if (/quota|resource_exhausted/i.test(message)) return "QUOTA";
  return "UPSTREAM";
}

// Turns the model's [{ name, ref }] field lists into the contract's records. Anything of another shape is
// passed through untouched so that structureResponse rejects it.
function fromWire(output: unknown): Record<string, unknown> {
  if (typeof output !== "object" || output === null || Array.isArray(output)) return {};
  const wire = output as { items?: unknown };
  if (!Array.isArray(wire.items)) return { ...output };
  const items = wire.items.map((item: { fields?: unknown }) =>
    item && Array.isArray(item.fields)
      ? { ...item, fields: Object.fromEntries(item.fields.map((f: { name: string; ref: string }) => [f?.name, f?.ref])) }
      : item,
  );
  return { ...output, items };
}

// One Gemini call with structured output. Returns the parsed JSON and usage, or the failure Response.
async function generate(prompt: string, schema: unknown, env: Env, fetcher: Fetcher): Promise<{ output: unknown; usage: object } | Response> {
  const model = env.GEMINI_MODEL_STRUCTURE || DEFAULT_MODEL;
  let upstream: Response;
  try {
    upstream = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
      }),
    });
  } catch {
    return failure("UPSTREAM");
  }
  if (!upstream.ok) return failure(await geminiFailure(upstream));

  const answer = (await upstream.json().catch(() => null)) as GeminiAnswer | null;
  const candidate = answer?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") return failure("RESULT_TOO_LARGE");
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  try {
    const usage = { model, inputTokens: answer?.usageMetadata?.promptTokenCount ?? 0, outputTokens: answer?.usageMetadata?.candidatesTokenCount ?? 0 };
    return { output: JSON.parse(text), usage };
  } catch {
    return failure("INVALID_OUTPUT");
  }
}

async function structure(request: StructureRequest, env: Env, fetcher: Fetcher): Promise<Response> {
  const result = await generate(structurePrompt(request), responseSchema, env, fetcher);
  if (result instanceof Response) return result;
  const parsed = structureResponse.safeParse({ ...fromWire(result.output), usage: result.usage });
  // Refs the request does not contain are dropped by the server's finalize step (SPEC §9.4), not here.
  return parsed.success ? json(parsed.data, 200) : failure("INVALID_OUTPUT");
}

// SPEC §9.4 (2026-11-05): Gemini copies the source text into a reduced editor schema; the server aligns it.
const textBlocks = {
  anyOf: [
    { type: "OBJECT", required: ["type", "level", "text"], properties: { type: { type: "STRING", enum: ["heading"] }, level: { type: "INTEGER", description: "2 or 3 only" }, text: { type: "STRING" } } },
    { type: "OBJECT", required: ["type", "text"], properties: { type: { type: "STRING", enum: ["paragraph", "quote"] }, text: { type: "STRING" } } },
    { type: "OBJECT", required: ["type", "items"], properties: { type: { type: "STRING", enum: ["bulletList", "orderedList"] }, items: { type: "ARRAY", items: { type: "STRING" } } } },
    {
      type: "OBJECT",
      required: ["type", "imageId", "display", "caption"],
      properties: {
        type: { type: "STRING", enum: ["stillImage"] },
        imageId: { type: "STRING" },
        display: { type: "STRING", enum: [...IMAGE_DISPLAYS] },
        caption: { type: "STRING", nullable: true },
      },
    },
  ],
};
const textSchema = {
  type: "OBJECT",
  required: ["items", "outline", "variants"],
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["kind", "label", "blocks", "fields"],
        properties: {
          kind: { type: "STRING", enum: [...CONTENT_KINDS] },
          label: { type: "STRING", nullable: true },
          blocks: { type: "ARRAY", items: textBlocks },
          fields: { type: "ARRAY", items: { type: "OBJECT", required: ["name", "value"], properties: { name: { type: "STRING" }, value: { type: "STRING" } } } },
        },
      },
    },
    outline: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["section", "title", "items"],
        properties: { section: { type: "STRING", enum: [...SECTION_KINDS] }, title: { type: "STRING", nullable: true }, items: { type: "ARRAY", items: { type: "INTEGER" } } },
      },
    },
    variants: { type: "ARRAY", items: { type: "OBJECT", required: ["use", "instead"], properties: { use: { type: "STRING" }, instead: { type: "STRING" } } } },
  },
};

function textPrompt(input: StructureInput): string {
  return [
    "You structure the text of a museum or gallery guide for visitors. Below is one chunk of one document, as plain text per page.",
    `Group the pages into content items. Each item has one kind from: ${CONTENT_KINDS.join(", ")}.`,
    "Your job is layout, not writing: lay out every line of each item's source text into its blocks, in source order: the title as a heading, then each label line (artist, date, medium, dimensions, credit) and each description as paragraphs. Only whitespace defects such as split letters may be fixed.",
    "Never add, translate, reword or summarize words. Do not write anything that is not in the source.",
    "Heading levels are 2 or 3 only. `label` is only for a name that appears nowhere in the source (it will be flagged); otherwise null.",
    "Images are placed by asset id only (stillImage with imageId); put a caption only if the source has one.",
    "`fields` repeat artwork values from those lines, copied from the source and named title, artist, year, medium, dimensions and credit where they apply; they never replace blocks.",
    "`outline` lists the guide's sections with indexes into `items`. Leave `variants` empty unless clearly needed.",
    `Document: ${input.document.mediaType}${input.document.category ? `, ${input.document.category}` : ""}`,
    `Available images: ${input.images.map((i) => `${i.id}${i.page ? ` (page ${i.page})` : ""}`).join(", ") || "none"}`,
    "",
    ...input.pages.map((p) => `--- Page ${p.page} ---\n${p.text}`),
  ].join("\n");
}

// The schema cannot enumerate integers, so heading levels outside 2..3 are pulled into range.
function clampLevels(blocks: unknown): unknown {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => (b?.type === "heading" && typeof b.level === "number" ? { ...b, level: b.level <= 2 ? 2 : 3 } : b));
}

// What the schema cannot express is cleaned here: the model may only place images it was offered (it
// invents ids otherwise, which failed whole chunks), and empty texts or list items carry nothing.
type WireBlock = { type?: string; text?: unknown; items?: unknown; imageId?: unknown };
function cleanBlocks(blocks: unknown, offered: Set<string>): unknown {
  if (!Array.isArray(blocks)) return blocks;
  const filled = (t: unknown) => typeof t === "string" && t.trim().length > 0;
  return (clampLevels(blocks) as WireBlock[]).flatMap((b): WireBlock[] => {
    if (b?.type === "stillImage") return typeof b.imageId === "string" && offered.has(b.imageId) ? [b] : [];
    if (b?.type === "bulletList" || b?.type === "orderedList") {
      const items = Array.isArray(b.items) ? b.items.filter(filled) : [];
      return items.length ? [{ ...b, items }] : [];
    }
    return b && "text" in b && !filled(b.text) ? [] : [b];
  });
}

async function structureText(input: StructureInput, env: Env, fetcher: Fetcher): Promise<Response> {
  const result = await generate(textPrompt(input), textSchema, env, fetcher);
  if (result instanceof Response) return result;
  const offered = new Set(input.images.map((i) => i.id));
  const wire = result.output as { items?: { blocks?: unknown; fields?: { name: string; value: string }[] }[] } | null;
  const fieldsOf = (fields: { name: string; value: string }[]) =>
    Object.fromEntries(fields.filter((f) => typeof f?.name === "string" && f.name.trim() && f.name.length <= 64 && typeof f.value === "string").map((f) => [f.name.trim(), f.value]));
  const items = Array.isArray(wire?.items)
    ? wire.items.map((item) => (item && Array.isArray(item.fields) ? { ...item, suggestions: [], blocks: cleanBlocks(item.blocks, offered), fields: fieldsOf(item.fields) } : item))
    : wire?.items;
  const parsed = structureOutput.safeParse({ ...(wire ?? {}), items, usage: result.usage });
  return parsed.success ? json(parsed.data, 200) : invalidOutput(parsed.error);
}

// SPEC §9.4 제안: Gemini proposes edits to the text blocks. The proposal is a free map on the wire, so it
// travels as a JSON string.
const suggestSchema = {
  type: "OBJECT",
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["contentId", "kind", "node", "proposal", "rationale"],
        properties: {
          contentId: { type: "STRING", nullable: true },
          kind: { type: "STRING", enum: [...SUGGEST_KINDS] },
          node: { type: "STRING" },
          proposal: { type: "STRING", description: "JSON object" },
          rationale: { type: "STRING" },
        },
      },
    },
  },
};

function suggestPrompt(input: SuggestInput): string {
  return [
    "You review the text blocks of a museum or gallery guide and propose small editing suggestions.",
    "Each suggestion has a kind and a `node` (a block id below) and a `proposal` JSON object with exactly these shapes:",
    "TEXT_EXTRACTION_FIX {text}; PUNCTUATION_CONSISTENCY {from, to}; STRUCTURE_LEVEL {level: 2|3};",
    "MISSING_HEADING {text, level}; SPLIT_FOR_MOBILE {offsets: character offsets}; GUIDE_SENTENCE_CANDIDATE {sentence}.",
    "Set contentId to the item's id. Suggest only when clearly useful; an empty list is fine.",
    "",
    ...input.items.flatMap((i) => [`Item ${i.contentId} (${i.kind})`, ...i.blocks.map((b) => `  ${b.id} [${b.type}] ${b.text}`)]),
  ].join("\n");
}

async function suggest(input: SuggestInput, env: Env, fetcher: Fetcher): Promise<Response> {
  const result = await generate(suggestPrompt(input), suggestSchema, env, fetcher);
  if (result instanceof Response) return result;
  const wire = result.output as { suggestions?: { node: string; proposal: string }[] } | null;
  try {
    const suggestions = (wire?.suggestions ?? []).map(({ node, proposal, ...rest }) => ({ ...rest, target: { node }, proposal: JSON.parse(proposal) }));
    const parsed = suggestOutput.safeParse({ suggestions, usage: result.usage });
    return parsed.success ? json(parsed.data, 200) : failure("INVALID_OUTPUT");
  } catch {
    return failure("INVALID_OUTPUT");
  }
}

// SPEC §10.7 검증: each asset's bytes are read from the original by range and hashed. The presigned `url`
// is a credential, so it is never logged.
const verifyInput = z.object({
  url: z.url(),
  ranges: z.array(z.object({ assetId: z.string(), offset: z.number().int().nonnegative(), length: z.number().int().positive(), sha256: z.string() })),
});

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verify(input: z.infer<typeof verifyInput>, fetcher: Fetcher): Promise<Response> {
  const results = [];
  for (const { assetId, offset, length, sha256 } of input.ranges) {
    const res = await fetcher(input.url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
    if (!res.ok) return failure("UPSTREAM");
    const bytes = await res.arrayBuffer();
    // A server that ignores Range answers 200 with the whole file.
    const range = res.status === 206 ? bytes : bytes.slice(offset, offset + length);
    results.push({ assetId, ok: (await sha256Hex(range)) === sha256 });
  }
  return json({ results }, 200);
}

export function createWorker(fetcher: Fetcher = (url, init) => fetch(url, init)) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const isText = url.pathname === "/structure/text";
      const isVerify = url.pathname === "/verify";
      const isSuggest = url.pathname === "/suggest";
      if (url.pathname !== "/structure" && !isText && !isVerify && !isSuggest) return json({ error: "NOT_FOUND" }, 404);
      if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

      const body = await request.text();
      const now = Math.floor(Date.now() / 1000);
      // An unset secret must never authenticate anyone.
      if (!env.ANALYSIS_WORKER_SECRET || !(await verifyWorkerRequest(env.ANALYSIS_WORKER_SECRET, body, request.headers, now))) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(body);
      } catch {
        return json({ error: "BAD_REQUEST" }, 400);
      }
      if (isSuggest) {
        const input = suggestInput.safeParse(raw);
        return input.success ? suggest(input.data, env, fetcher) : json({ error: "BAD_REQUEST" }, 400);
      }
      if (isVerify) {
        const input = verifyInput.safeParse(raw);
        return input.success ? verify(input.data, fetcher) : json({ error: "BAD_REQUEST" }, 400);
      }
      if (isText) {
        const input = structureInput.safeParse(raw);
        return input.success ? structureText(input.data, env, fetcher) : json({ error: "BAD_REQUEST" }, 400);
      }
      const parsed = structureRequest.safeParse(raw);
      if (!parsed.success) return json({ error: "BAD_REQUEST" }, 400);
      return structure(parsed.data, env, fetcher);
    },
  };
}

export default createWorker();
