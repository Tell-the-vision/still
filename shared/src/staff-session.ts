import { z } from "zod";

// Sign-in input for institution staff and STILL operators (SPEC §9.5). Shapes only: a malformed
// email or ID simply fails like any other wrong credential (SPEC §10.5).
const email = z.string().trim().min(1).max(320);
const password = z.string().min(1).max(1024);

export const consoleSessionCreateInput = z.object({
  institutionCode: z.string().trim().min(1).max(64),
  email,
  password,
  remember: z.boolean().optional(),
});

export const adminSessionCreateInput = z.object({ email, password });

// A work email as stored for login: lowercase with one @ (SPEC §10.2 user_tokens CHECK).
export const staffEmail = z.string().trim().toLowerCase().max(320).regex(/^[^@\s]+@[^@\s]+$/);
