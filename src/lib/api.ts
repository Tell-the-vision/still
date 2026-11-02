/**
 * Server-side helpers for API route handlers.
 * Error shape follows spec §12.7:  { error: { code, message } }
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  INTERNAL_ERROR: 500,
};

export class HttpError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export function apiError(code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/** Current user row, or null when logged out / user row deleted. */
export async function currentUser(): Promise<User | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  return row ?? null;
}

/** Logged-in and not suspended. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError("UNAUTHORIZED", "로그인이 필요합니다.");
  if (user.status === "SUSPENDED")
    throw new HttpError("FORBIDDEN", "정지된 계정입니다. 관리자에게 문의해 주세요.");
  return user;
}

export function isAdmin(user: Pick<User, "role">) {
  return user.role === "ADMIN";
}

/** Approved artist (or admin). */
export function isArtist(user: Pick<User, "role" | "artistStatus">) {
  return user.role === "ADMIN" || (user.role === "ARTIST" && user.artistStatus === "APPROVED");
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new HttpError("FORBIDDEN", "관리자만 접근할 수 있습니다.");
  return user;
}

export async function requireArtist(): Promise<User> {
  const user = await requireUser();
  if (!isArtist(user)) throw new HttpError("FORBIDDEN", "승인된 아티스트만 접근할 수 있습니다.");
  return user;
}

/** Public shape of the current user (never expose googleId). */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    image: user.image,
    role: user.role,
    status: user.status,
    artistStatus: user.artistStatus,
    artistName: user.artistName,
    artistBio: user.artistBio,
    artistPortfolioUrl: user.artistPortfolioUrl,
    artistAppliedAt: user.artistAppliedAt,
    artistReviewedAt: user.artistReviewedAt,
    artistReviewNote: user.artistReviewNote,
    suspendedReason: user.suspendedReason,
    createdAt: user.createdAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError("BAD_REQUEST", "요청 본문이 올바른 JSON이 아닙니다.");
  }
}

/**
 * Wrap a route handler so thrown HttpErrors (and unexpected errors) become
 * the standard JSON error response.
 */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return apiError(err.code, err.message);
      console.error("[api]", err);
      return apiError("INTERNAL_ERROR", "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };
}

/** Next 15: route params are a Promise. */
export type Params<T> = { params: Promise<T> };
