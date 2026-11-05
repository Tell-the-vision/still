import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import type { AppCode } from "@still/shared/errors";
import type { Session, StaffSurface } from "../auth/sessions";
import { ipAllowed, userAllowed } from "../rate-limit";
import { hasCurrentConsent } from "../services/consent";
import type { Context, Surface } from "./context";

export class AppError extends Error {
  constructor(public readonly appCode: AppCode) {
    super(appCode);
  }
}

const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<Context>().create({
  isDev: !isProduction,
  sse: { ping: { enabled: true, intervalMs: 15_000 } }, // SPEC §11.1 heartbeat
  errorFormatter({ shape, error }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      // Log the cause only: input values must never reach the logs.
      console.error(error.cause ?? error);
    }
    return {
      ...shape,
      // Thrown messages can contain SQL or constraint names (SPEC §11.2).
      message:
        isProduction && error.code === "INTERNAL_SERVER_ERROR"
          ? "Internal error"
          : shape.message,
      data: {
        ...shape.data,
        appCode: error.cause instanceof AppError ? error.cause.appCode : undefined,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Dotted numeric compare; a missing or malformed version counts as below (SPEC §11.2).
function isBelow(version: string | null, minimum: string) {
  const parts = (v: string) => v.split(".").map(Number);
  if (!version || parts(version).some(Number.isNaN)) return true;
  const [a, b] = [parts(version), parts(minimum)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

// Native clients older than MIN_CLIENT_VERSION must upgrade; web is never checked.
const versionCheck = t.middleware(({ ctx, next }) => {
  const client = ctx.req.headers.get("x-client");
  const native = client === "ios" || client === "android";
  if (native && isBelow(ctx.req.headers.get("x-client-version"), process.env.MIN_CLIENT_VERSION ?? "1.0.0")) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", cause: new AppError("CLIENT_UPGRADE_REQUIRED") });
  }
  return next();
});

export const clientProcedure = t.procedure.use(versionCheck);

const tooManyRequests = () => new TRPCError({ code: "TOO_MANY_REQUESTS" });

// Unauthenticated sign-in calls are limited per IP (SPEC §11.1).
export const ipLimitedProcedure = clientProcedure.use(({ ctx, next }) => {
  if (!ipAllowed(ctx.req)) throw tooManyRequests();
  return next();
});

// Each surface serves exactly one role; any other role is FORBIDDEN (SPEC §10.5).
const ROLE_OF: Record<Surface, Session["role"]> = { visitor: "VISITOR", console: "INSTITUTION", admin: "ADMIN" };

// The app a call comes from. The console and Admin send `x-client: console | admin` (SPEC §11.1 x-client);
// anything else is the visitor app.
export function surfaceOf(req: Request): Surface {
  // EventSource cannot set headers, so the watch subscription passes `?client=console` instead.
  const client = req.headers.get("x-client") ?? new URL(req.url).searchParams.get("client");
  return client === "console" || client === "admin" ? client : "visitor";
}

// A session of `surface` whose user has that surface's role. Every signed-in call counts against the per-user limit.
function requireSession(surface: Surface, session: Session | null) {
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (session.role !== ROLE_OF[surface]) throw new TRPCError({ code: "FORBIDDEN" });
  if (!userAllowed(session.userId)) throw tooManyRequests();
  return session;
}

// Visitor procedures (SPEC §10.5: Archive, Scrap, Journal, Keepsake, consent, settings, identity.*, me.delete).
export const protectedProcedure = clientProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { session: requireSession("visitor", await ctx.getSession("visitor")) } }),
);

// me.get, session.delete and password.update serve every role; the calling app picks the session (SPEC §9.5).
export const callerProcedure = clientProcedure.use(async ({ ctx, next }) => {
  const surface = surfaceOf(ctx.req);
  return next({ ctx: { surface, session: requireSession(surface, await ctx.getSession(surface)) } });
});

// Staff with a temporary password may only read me.get, change it or sign out (SPEC §10.5 must_change_password).
function staffProcedure(surface: StaffSurface) {
  return clientProcedure.use(async ({ ctx, next }) => {
    const session = requireSession(surface, await ctx.getSession(surface));
    if (session.mustChangePassword) {
      throw new TRPCError({ code: "FORBIDDEN", cause: new AppError("PASSWORD_CHANGE_REQUIRED") });
    }
    return next({ ctx: { session } });
  });
}

// STILL Admin procedures (admin.*): operators only.
export const adminProcedure = staffProcedure("admin");

// Institution console procedures (console.*): scoped to the caller's own institution, which never
// comes from input (SPEC §9.2 권한).
export const consoleProcedure = staffProcedure("console").use(({ ctx, next }) => {
  const institutionId = ctx.session.institutionId;
  if (!institutionId) throw new TRPCError({ code: "FORBIDDEN" }); // the users CHECK makes this unreachable
  return next({ ctx: { institutionId } });
});

// Procedures on personal data require agreement to the current policies (SPEC §2.2 Consent): the user's
// latest agreement must name the versions served now, so a policy update asks everyone again.
export const consentedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await hasCurrentConsent(ctx.session.userId))) {
    throw new TRPCError({ code: "FORBIDDEN", cause: new AppError("CONSENT_REQUIRED") });
  }
  return next();
});
