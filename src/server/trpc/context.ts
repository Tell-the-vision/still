import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyAccessToken } from "../auth/access-token";
import { SESSION_COOKIE, hashToken } from "../auth/sessions";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

export type Session = { userId: string; userTokenId: string | null; tokenHash: string };

// Public procedures never call getSession, so they never read cookies (SPEC §11.1).
export function createContext(req: Request) {
  let session: Promise<Session | null> | undefined;

  // SPEC §2.3: a Bearer token wins; cookies and Origin are ignored. The session row must still exist.
  async function loadBearerSession(token: string) {
    try {
      const { sid } = await verifyAccessToken(token);
      const [row] = await db
        .select({ userId: userSessions.userId, userTokenId: userSessions.userTokenId, tokenHash: userSessions.tokenHash })
        .from(userSessions)
        .where(and(eq(userSessions.id, sid), eq(userSessions.kind, "APP"), gt(userSessions.expiresAt, new Date())));
      return row ?? null;
    } catch {
      return null; // bad signature, expired or malformed token
    }
  }

  async function loadSession() {
    const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (bearer) return loadBearerSession(bearer);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    // CSRF guard (SPEC §2.3): a cookie-authenticated request must come from our own origin.
    if (req.headers.get("origin") !== process.env.STILL_ORIGIN) throw new TRPCError({ code: "FORBIDDEN" });
    const [row] = await db
      .select({ userId: userSessions.userId, userTokenId: userSessions.userTokenId, tokenHash: userSessions.tokenHash })
      .from(userSessions)
      .where(and(eq(userSessions.tokenHash, hashToken(token)), eq(userSessions.kind, "WEB"), gt(userSessions.expiresAt, new Date())));
    return row ?? null;
  }

  return { req, getSession: () => (session ??= loadSession()) };
}

export type Context = ReturnType<typeof createContext>;
