import { z } from "zod";

// password.update for institution staff and operators (SPEC §9.5). The minimum length is checked in
// the procedure so a short password is BAD_REQUEST PASSWORD_TOO_WEAK (SPEC §11.2).
export const passwordUpdateInput = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().max(1024),
});
