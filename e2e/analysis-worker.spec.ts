import { expect, test } from "next/experimental/testmode/playwright";
import { signWorkerRequest } from "../shared/src/analysis-worker-signature";
import { createWorker } from "../worker/src/index";

// Pure tests of the analysis Worker (SPEC §9.4 구조화, §9.6, §10.10): its fetch handler is called directly
// with a stubbed Gemini, so no app page is needed.
const SECRET = "test-secret";
const now = () => Math.floor(Date.now() / 1000);

const request = {
  analysisId: "7b0f3b1e-5a53-4a52-9d0e-2f2d5b8f1a11",
  chunk: 0,
  documents: [{ alias: "d1", mediaType: "application/pdf", category: null }],
  segments: [
    { ref: "d1:s001", page: 1, text: "Forms of Stillness", sentences: 1 },
    { ref: "d1:s002", page: 1, text: "An introduction to the show.", sentences: 1 },
  ],
  images: [],
};

const structure = {
  items: [{ key: "i1", kind: "INTRODUCTION", blocks: [{ type: "heading", refs: ["d1:s001"] }], fields: [{ name: "title", ref: "d1:s001" }], label: null }],
  outline: [],
};

function geminiAnswer(text: string) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30 } }),
    { status: 200 },
  );
}

async function call(gemini: () => Response, { body = JSON.stringify(request), at = now(), secret = SECRET } = {}) {
  const prompts: string[] = [];
  const worker = createWorker((_url, init) => {
    prompts.push(String(init?.body));
    return Promise.resolve(gemini());
  });
  const headers = await signWorkerRequest(secret, body, at);
  const response = await worker.fetch(
    new Request("https://worker.test/structure", { method: "POST", body, headers }),
    { GEMINI_KEY: "gemini-key", ANALYSIS_WORKER_SECRET: SECRET, GEMINI_MODEL_STRUCTURE: "gemini-test" },
  );
  return { response, prompts };
}

test("a wrong signature is refused before Gemini is called", async () => {
  const { response, prompts } = await call(() => geminiAnswer("{}"), { secret: "other" });
  expect((await response).status).toBe(401);
  expect(prompts).toHaveLength(0);
});

test("a six-minute-old timestamp is refused", async () => {
  const { response } = await call(() => geminiAnswer("{}"), { at: now() - 360 });
  expect((await response).status).toBe(401);
});

test("an invalid body is a 400", async () => {
  const { response } = await call(() => geminiAnswer("{}"), { body: JSON.stringify({ chunk: "x" }) });
  expect((await response).status).toBe(400);
});

test("a valid structure comes back with usage and never leaks the key", async () => {
  const { response, prompts } = await call(() => geminiAnswer(JSON.stringify(structure)));
  const res = await response;
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.usage).toEqual({ model: "gemini-test", inputTokens: 120, outputTokens: 30 });
  expect(JSON.stringify(body)).not.toContain("gemini-key");
  expect(prompts[0]).toContain("d1:s002");
});

test("malformed Gemini JSON is INVALID_OUTPUT", async () => {
  const res = (await call(() => geminiAnswer("not json"))).response;
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "INVALID_OUTPUT" });
});

test("Gemini 429 is QUOTA", async () => {
  const res = (await call(() => new Response("{}", { status: 429 }))).response;
  expect(await res.json()).toEqual({ error: "QUOTA" });
});

test("Gemini location refusal is LOCATION_DENIED", async () => {
  const res = (await call(() => new Response(JSON.stringify({ error: { message: "User location is not supported for the API use." } }), { status: 400 }))).response;
  expect(await res.json()).toEqual({ error: "LOCATION_DENIED" });
});

test("a truncated Gemini answer is RESULT_TOO_LARGE", async () => {
  const truncated = new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }), { status: 200 });
  const res = (await call(() => truncated)).response;
  expect(await res.json()).toEqual({ error: "RESULT_TOO_LARGE" });
});
