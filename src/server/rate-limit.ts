// In-memory fixed window; counts reset per process (single instance).
const windows = new Map<string, { count: number; resetAt: number }>();

// Returns false once `key` has used up `limit` hits in the current window.
export function hit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  const current = windows.get(key) ?? { count: 0, resetAt: now + windowMs };
  current.count += 1;
  windows.set(key, current);
  return current.count <= limit;
}

// The proxy's forwarded address is trusted only behind a known proxy (TRUST_PROXY=1). That proxy appends
// the address it saw; entries before it come from the client and can be anything, so the last one is used.
export function clientIp(req: Request) {
  if (process.env.TRUST_PROXY !== "1") return "local";
  return req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}

// A blank value (as .env.example ships) means the default: Number("") would be 0 and refuse every call.
const limitOf = (name: string, fallback: number) => Number(process.env[name] || fallback);

export const ipAllowed = (req: Request) => hit(`ip:${clientIp(req)}`, limitOf("RATE_LIMIT_IP_PER_MIN", 30));
export const userAllowed = (userId: string) => hit(`user:${userId}`, limitOf("RATE_LIMIT_USER_PER_MIN", 120));

// Password sign-in is limited per email as well as per IP (SPEC §11.1); lockout is separate (SPEC §10.5).
export const loginAllowed = (email: string) =>
  hit(`login:${email.trim().toLowerCase()}`, limitOf("RATE_LIMIT_LOGIN_PER_MIN", 20));
