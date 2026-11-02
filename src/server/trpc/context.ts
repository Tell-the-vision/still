import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { SESSION_COOKIE, hashToken } from "../auth/sessions";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

function readCookie(req: Request, name: string) {
  const pair = req.headers.get("cookie")?.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return pair?.slice(name.length + 1);
}

export type Session = { userId: string; userTokenId: string | null };

// Public procedures never call getSession, so they never read cookies (SPEC §11.1).
export function createContext(req: Request, resHeaders: Headers) {
  let session: Promise<Session | null> | undefined;

  async function loadSession() {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return null;
    // CSRF guard (SPEC §2.3): a cookie-authenticated request must come from our own origin.
    if (req.headers.get("origin") !== process.env.STILL_ORIGIN) throw new TRPCError({ code: "FORBIDDEN" });
    const [row] = await db
      .select({ userId: userSessions.userId, userTokenId: userSessions.userTokenId })
      .from(userSessions)
      .where(and(eq(userSessions.tokenHash, hashToken(token)), eq(userSessions.kind, "WEB"), gt(userSessions.expiresAt, new Date())));
    return row ?? null;
  }

  return { req, resHeaders, getSession: () => (session ??= loadSession()) };
}

export type Context = ReturnType<typeof createContext>;
