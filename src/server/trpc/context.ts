import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyAccessToken } from "../auth/access-token";
import { SESSION_COOKIE, STAFF_COOKIES, findSession, findWebSession, type Session, type StaffSurface } from "../auth/sessions";
import { userSessions } from "../db/schema";

export type { Session };

// The app a request comes from: the visitor app, the institution console or STILL Admin.
// Each signs in with its own session (SPEC §10.5, §11.1).
export type Surface = "visitor" | StaffSurface;

// Public procedures never call getSession, so they never read cookies (SPEC §11.1).
export function createContext(req: Request) {
  const sessions = new Map<Surface, Promise<Session | null>>();

  // SPEC §2.3: a Bearer token wins; cookies and Origin are ignored. The session row must still exist.
  async function loadBearerSession(token: string) {
    try {
      const { sid } = await verifyAccessToken(token);
      return await findSession(and(eq(userSessions.id, sid), eq(userSessions.kind, "APP"))!);
    } catch {
      return null; // bad signature, expired or malformed token
    }
  }

  async function loadCookieSession(cookieName: string) {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return null;
    // CSRF guard (SPEC §2.3): a cookie-authenticated request must come from our own origin.
    // A browser sends no Origin on the same-origin GET of an EventSource (console.analysis.watch); Sec-Fetch-Site vouches for it.
    const sseWatch = req.method === "GET" && !req.headers.has("origin") && new URL(req.url).pathname.endsWith("/console.analysis.watch")
      && req.headers.get("sec-fetch-site") === "same-origin";
    if (!sseWatch && req.headers.get("origin") !== process.env.STILL_ORIGIN) throw new TRPCError({ code: "FORBIDDEN" });
    return findWebSession(token);
  }

  function loadSession(surface: Surface) {
    // The console and Admin are web apps with cookie sessions only (SPEC §11.1 콘솔 라우터).
    if (surface !== "visitor") return loadCookieSession(STAFF_COOKIES[surface]);
    const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    return bearer ? loadBearerSession(bearer) : loadCookieSession(SESSION_COOKIE);
  }

  function getSession(surface: Surface = "visitor") {
    if (!sessions.has(surface)) sessions.set(surface, loadSession(surface));
    return sessions.get(surface)!;
  }

  return { req, getSession };
}

export type Context = ReturnType<typeof createContext>;
