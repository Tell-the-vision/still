import { hash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "../db/client";
import { institutions, userSessions, userTokens, users } from "../db/schema";

export const SESSION_COOKIE = "still_session";
const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;

// Institution console and STILL Admin sessions live in their own cookies, so they never
// mix with a visitor sign-in in the same browser (SPEC §10.5 세션).
export const STAFF_COOKIES = { console: "still_console_session", admin: "still_admin_session" } as const;
export type StaffSurface = keyof typeof STAFF_COOKIES;
const STAFF_SESSION_SECONDS = 12 * 60 * 60; // browser-session cookie
const REMEMBERED_STAFF_SESSION_SECONDS = 30 * 24 * 60 * 60; // "Remember this device"

export type Role = "VISITOR" | "INSTITUTION" | "ADMIN";
export type Session = {
  userId: string;
  userTokenId: string | null;
  tokenHash: string;
  role: Role;
  institutionId: string | null;
  mustChangePassword: boolean;
};

export const hashToken = (token: string) => hash("sha256", token);
export const cookieDefaults = () =>
  ({ httpOnly: true, sameSite: "lax", secure: process.env.STILL_ORIGIN?.startsWith("https:") ?? false }) as const;

// SPEC §2.3: opaque token in the cookie, only its sha256 in the database.
async function insertWebSession(userId: string, userTokenId: string, seconds: number) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date())); // lazy cleanup of expired rows
  await db.insert(userSessions).values({
    userId,
    userTokenId,
    kind: "WEB",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + seconds * 1000),
  });
  return token;
}

export const createWebSession = (userId: string, userTokenId: string) =>
  insertWebSession(userId, userTokenId, WEB_SESSION_SECONDS);

export const createStaffSession = (userId: string, userTokenId: string, remember: boolean) =>
  insertWebSession(userId, userTokenId, remember ? REMEMBERED_STAFF_SESSION_SECONDS : STAFF_SESSION_SECONDS);

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieDefaults(), path: "/", maxAge: WEB_SESSION_SECONDS });
}

export async function clearSessionCookie() {
  (await cookies()).delete({ name: SESSION_COOKIE, ...cookieDefaults(), path: "/" });
}

// Without "Remember this device" the cookie ends with the browser; the row still expires after 12 h.
export async function setStaffCookie(surface: StaffSurface, token: string, remember: boolean) {
  const maxAge = remember ? { maxAge: REMEMBERED_STAFF_SESSION_SECONDS } : {};
  (await cookies()).set(STAFF_COOKIES[surface], token, { ...cookieDefaults(), path: "/", ...maxAge });
}

export async function clearStaffCookie(surface: StaffSurface) {
  (await cookies()).delete({ name: STAFF_COOKIES[surface], ...cookieDefaults(), path: "/" });
}

// The unexpired session matching `where`, only while its user is ACTIVE and, for institution
// staff, the institution is ACTIVE too: checked on every request (SPEC §10.5 세션).
export async function findSession(where: SQL): Promise<Session | null> {
  const [row] = await db
    .select({
      userId: userSessions.userId,
      userTokenId: userSessions.userTokenId,
      tokenHash: userSessions.tokenHash,
      role: sql<Role>`${users.role}`,
      institutionId: users.institutionId,
      mustChangePassword: sql<boolean>`coalesce(${userTokens.mustChangePassword}, false)`,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(userTokens, eq(userTokens.id, userSessions.userTokenId))
    .where(and(
      where,
      gt(userSessions.expiresAt, new Date()),
      eq(users.status, "ACTIVE"),
      or(isNull(users.institutionId), eq(institutions.status, "ACTIVE")),
    ));
  return row ?? null;
}

// The WEB session for a cookie token (SPEC §2.3). Staff cookies hold WEB sessions too.
export const findWebSession = (token: string) =>
  findSession(and(eq(userSessions.tokenHash, hashToken(token)), eq(userSessions.kind, "WEB"))!);

// Visitor-only browser flows (OAuth link intent): a staff session never counts here.
export async function currentWebSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await findWebSession(token) : null;
  return session?.role === "VISITOR" ? session : null;
}
