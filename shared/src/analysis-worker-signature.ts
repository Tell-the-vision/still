import { WORKER_MAX_SKEW_SECONDS, WORKER_SIGNATURE_HEADER, WORKER_TIMESTAMP_HEADER } from "./analysis-worker";

// Request signing for the analysis Worker (SPEC §10.10 Worker 호출). Web Crypto only, so the same code
// signs in the server's jobs (Node) and verifies inside the Worker.

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The two headers for a request whose raw body is `body`; `now` is unix seconds. */
export async function signWorkerRequest(secret: string, body: string, now: number): Promise<Record<string, string>> {
  return {
    [WORKER_TIMESTAMP_HEADER]: String(now),
    [WORKER_SIGNATURE_HEADER]: await hmacHex(secret, `${now}.${body}`),
  };
}

/** True when the timestamp is within the allowed skew and the signature matches (constant-time compare). */
export async function verifyWorkerRequest(secret: string, body: string, headers: Headers, now: number): Promise<boolean> {
  const timestamp = headers.get(WORKER_TIMESTAMP_HEADER) ?? "";
  const signature = headers.get(WORKER_SIGNATURE_HEADER) ?? "";
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > WORKER_MAX_SKEW_SECONDS) return false;
  const expected = await hmacHex(secret, `${timestamp}.${body}`);
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}
