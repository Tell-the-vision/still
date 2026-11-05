import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { verifyWorkerRequest } from "../../shared/src/analysis-worker-signature";

// A stand-in for the analysis Worker's POST /structure/text: checks the signature, then answers with one
// item whose paragraphs are the page texts it was sent.
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString();
  const headers = new Headers(req.headers as Record<string, string>);
  const reply = (status: number, value: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
  const isVerify = req.url === "/verify";
  if (req.url !== "/structure/text" && !isVerify || req.method !== "POST") return reply(404, {});
  if (!(await verifyWorkerRequest("e2e-analysis-worker-secret", body, headers, Math.floor(Date.now() / 1000)))) return reply(401, {});
  if (isVerify) {
    const { url, ranges } = JSON.parse(body) as { url: string; ranges: { assetId: string; offset: number; length: number; sha256: string }[] };
    const file = Buffer.from(await (await fetch(url)).arrayBuffer());
    return reply(200, { results: ranges.map((r) => ({ assetId: r.assetId, ok: createHash("sha256").update(file.subarray(r.offset, r.offset + r.length)).digest("hex") === r.sha256 })) });
  }
  const input = JSON.parse(body) as { pages: { text: string }[] };
  if (input.pages.some((p) => p.text.includes("SLOW"))) await new Promise((r) => setTimeout(r, 20000)); // lets a test cancel mid-run
  reply(200, {
    items: [{ kind: "ARTWORK", label: null, blocks: input.pages.map((p) => ({ type: "paragraph", text: p.text })), fields: {}, suggestions: [] }],
    outline: [],
    variants: [],
    usage: { model: "fake", inputTokens: 1, outputTokens: 1 },
  });
}).listen(Number(process.env.FAKE_WORKER_PORT));
