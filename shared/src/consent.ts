import { z } from "zod";

export const consentUpsertInput = z.object({
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});
