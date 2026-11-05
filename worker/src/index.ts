import { structureRequest, structureResponse, type StructureRequest } from "../../shared/src/analysis-worker";
import { verifyWorkerRequest } from "../../shared/src/analysis-worker-signature";
import { CONTENT_KINDS } from "../../shared/src/console-content";
import { SECTION_KINDS } from "../../shared/src/console-draft";

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

async function structure(request: StructureRequest, env: Env, fetcher: Fetcher): Promise<Response> {
  const model = env.GEMINI_MODEL_STRUCTURE || DEFAULT_MODEL;
  let upstream: Response;
  try {
    upstream = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: structurePrompt(request) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0 },
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

  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    return failure("INVALID_OUTPUT");
  }
  const parsed = structureResponse.safeParse({
    ...fromWire(output),
    usage: { model, inputTokens: answer?.usageMetadata?.promptTokenCount ?? 0, outputTokens: answer?.usageMetadata?.candidatesTokenCount ?? 0 },
  });
  // Refs the request does not contain are dropped by the server's finalize step (SPEC §9.4), not here.
  return parsed.success ? json(parsed.data, 200) : failure("INVALID_OUTPUT");
}

export function createWorker(fetcher: Fetcher = (url, init) => fetch(url, init)) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname !== "/structure") return json({ error: "NOT_FOUND" }, 404);
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
      const parsed = structureRequest.safeParse(raw);
      if (!parsed.success) return json({ error: "BAD_REQUEST" }, 400);
      return structure(parsed.data, env, fetcher);
    },
  };
}

export default createWorker();
