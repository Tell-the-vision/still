import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { verifyWorkerRequest } from "../../shared/src/analysis-worker-signature";

// A stand-in for the analysis Worker's POST /structure/text: checks the signature, then answers with one
// item whose paragraphs are the page texts it was sent.

// "TOGETHER <n>": a chunk is answered once n chunks of its analysis are in flight at the same time, and fails after
// 8 s otherwise, so chunks sent one after another (or retried one by one) can never pass.
const together = new Map<string, { waiting: number; open: boolean }>();
async function waitTogether(analysisId: string, needed: number) {
  const group = together.get(analysisId) ?? { waiting: 0, open: false };
  together.set(analysisId, group);
  group.waiting += 1;
  if (group.waiting >= needed) group.open = true;
  const deadline = Date.now() + 8000;
  while (!group.open && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  group.waiting -= 1;
  return group.open;
}

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString();
  const headers = new Headers(req.headers as Record<string, string>);
  const reply = (status: number, value: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
  const isVerify = req.url === "/verify";
  const isSuggest = req.url === "/suggest";
  if (req.url !== "/structure/text" && !isVerify && !isSuggest || req.method !== "POST") return reply(404, {});
  if (!(await verifyWorkerRequest("e2e-analysis-worker-secret", body, headers, Math.floor(Date.now() / 1000)))) return reply(401, {});
  if (isSuggest) {
    const { items } = JSON.parse(body) as { items: { contentId: string; blocks: { id: string; text?: string }[] }[] };
    // "SLOW_SUGGEST" in the text lets a test check that the result waits for the suggestions.
    if (items.some((i) => i.blocks.some((b) => b.text?.includes("SLOW_SUGGEST")))) await new Promise((r) => setTimeout(r, 3000));
    return reply(200, {
      suggestions: [{ contentId: items[0].contentId, kind: "PUNCTUATION_CONSISTENCY", target: { node: items[0].blocks[0].id }, proposal: { from: "--", to: "—" }, rationale: "Use one dash style." }],
      usage: { model: "fake", inputTokens: 1, outputTokens: 1 },
    });
  }
  if (isVerify) {
    const { url, ranges } = JSON.parse(body) as { url: string; ranges: { assetId: string; offset: number; length: number; sha256: string }[] };
    const file = Buffer.from(await (await fetch(url)).arrayBuffer());
    return reply(200, { results: ranges.map((r) => ({ assetId: r.assetId, ok: createHash("sha256").update(file.subarray(r.offset, r.offset + r.length)).digest("hex") === r.sha256 })) });
  }
  const input = JSON.parse(body) as { analysisId: string; pages: { text: string }[]; images: { id: string; url: string | null }[] };
  const needed = /TOGETHER (\d+)/.exec(input.pages.map((p) => p.text).join(" "));
  if (needed && !(await waitTogether(input.analysisId, Number(needed[1])))) return reply(502, { error: "UPSTREAM" });
  if (input.pages.some((p) => p.text.includes("FAIL_STRUCTURE"))) return reply(502, { error: "INVALID_OUTPUT" }); // lets a test fail one document
  if (input.pages.some((p) => p.text.includes("SLOW"))) await new Promise((r) => setTimeout(r, 20000)); // lets a test cancel mid-run
  // "LOOK_AT_PICTURES": like the real Worker, fetch each offered picture. Each one fetched goes first (a picture placed
  // from its "[image a01]" marker alone would follow the text, so a test can tell it was seen), with a caption the
  // source does not have, which the server must drop.
  if (input.pages.some((p) => p.text.includes("LOOK_AT_PICTURES"))) {
    const seen = [];
    for (const image of input.images) if (image.url && (await fetch(image.url).catch(() => null))?.ok) seen.push(image.id);
    return reply(200, {
      items: [{ kind: "ARTWORK", label: null, blocks: [...seen.map((id) => ({ type: "stillImage", imageId: id, display: "INLINE", caption: "A stormy sea at dusk" })), ...input.pages.map((p) => ({ type: "paragraph", text: p.text.replace(/\s*\[image a\d{2,}\]\s*/g, " ").trim() }))], fields: {}, suggestions: [] }],
      outline: [],
      variants: [],
      usage: { model: "fake", inputTokens: 1, outputTokens: 1 },
    });
  }
  reply(200, {
    items: [{ kind: "ARTWORK", label: null, blocks: input.pages.map((p) => ({ type: "paragraph", text: p.text })), fields: {}, suggestions: [] }],
    outline: [],
    variants: [],
    usage: { model: "fake", inputTokens: 1, outputTokens: 1 },
  });
}).listen(Number(process.env.FAKE_WORKER_PORT));
