import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const TTL_MS = 30 * 60_000;
const BUCKET_MS = 10 * 60_000;

const payloadSchema = z.object({ userId: z.string(), archiveId: z.string(), updatedAt: z.string(), exp: z.number() });
type Payload = z.infer<typeof payloadSchema>;

// Read on use, not on import: `next build` loads route modules without runtime secrets.
const sign = (body: string) => {
  const secret = process.env.KEEPSAKE_TICKET_SECRET;
  if (!secret) throw new Error("KEEPSAKE_TICKET_SECRET is not set");
  return createHmac("sha256", secret).update(body).digest();
};

// SPEC §7.3: `exp` rounds up to a bucket so repeated reads in one bucket yield the same URL.
export function issueTicket({ userId, archiveId, updatedAt }: Omit<Payload, "exp">) {
  const exp = Math.ceil((Date.now() + TTL_MS) / BUCKET_MS) * BUCKET_MS;
  const body = Buffer.from(JSON.stringify({ userId, archiveId, updatedAt, exp })).toString("base64url");
  return { ticket: `${body}.${sign(body).toString("base64url")}`, expiresAt: new Date(exp) };
}

export function verifyTicket(ticket: string): Payload | null {
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString()));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
