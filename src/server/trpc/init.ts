import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import type { AppCode } from "@still/shared/errors";
import { ipAllowed, userAllowed } from "../rate-limit";
import { getConsent } from "../services/consent";
import type { Context } from "./context";

export class AppError extends Error {
  constructor(public readonly appCode: AppCode) {
    super(appCode);
  }
}

const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<Context>().create({
  isDev: !isProduction,
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

export const protectedProcedure = clientProcedure.use(async ({ ctx, next }) => {
  const session = await ctx.getSession();
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!userAllowed(session.userId)) throw tooManyRequests();
  return next({ ctx: { session } });
});

// Procedures on personal data require agreement to the current policies (SPEC §2.2 Consent).
export const consentedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await getConsent(ctx.session.userId))) {
    throw new TRPCError({ code: "FORBIDDEN", cause: new AppError("CONSENT_REQUIRED") });
  }
  return next();
});
