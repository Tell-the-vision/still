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

// The proxy's forwarded address is trusted only behind a known proxy (TRUST_PROXY=1).
export function clientIp(req: Request) {
  if (process.env.TRUST_PROXY !== "1") return "local";
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export const ipAllowed = (req: Request) => hit(`ip:${clientIp(req)}`, Number(process.env.RATE_LIMIT_IP_PER_MIN ?? 30));
export const userAllowed = (userId: string) => hit(`user:${userId}`, Number(process.env.RATE_LIMIT_USER_PER_MIN ?? 120));
