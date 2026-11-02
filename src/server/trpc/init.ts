import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import type { AppCode } from "@still/shared/errors";
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

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await ctx.getSession();
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session } });
});

// Procedures on personal data require agreement to the current policies (SPEC §2.2 Consent).
export const consentedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await getConsent(ctx.session.userId))) {
    throw new TRPCError({ code: "FORBIDDEN", cause: new AppError("CONSENT_REQUIRED") });
  }
  return next();
});
