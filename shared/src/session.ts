import { z } from "zod";

export const sessionCreateInput = z.object({
  provider: z.literal("GOOGLE"),
  code: z.string().min(1),
  codeVerifier: z.string().optional(),
  redirectUri: z.string().optional(),
});

export const sessionRefreshInput = z.object({ refreshToken: z.string().min(1) });
