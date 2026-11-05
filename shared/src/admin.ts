import { z } from "zod";
import { staffEmail } from "./staff-session";

// STILL Admin inputs (SPEC §9.5 admin.*). Outputs: InstitutionRow and AccountRow in
// src/server/services/admin/.

// The institution ID staff type to sign in (SPEC §10.3 institutions.code), e.g. STL-SEO-0001.
// Procedures check it themselves so a mismatch is BAD_REQUEST CODE_INVALID (SPEC §11.2).
export const INSTITUTION_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const INSTITUTION_DISPLAY_STATUSES = ["ACTIVE", "PENDING_SETUP", "SUSPENDED"] as const;

const name = z.string().trim().min(1).max(200);
const tokenLimit = z.number().int().positive().nullable(); // null: the server default (SPEC §10.3)

export const adminInstitutionListInput = z.object({
  q: z.string().trim().max(100).optional(), // name or institution ID, case-insensitive
  status: z.enum(INSTITUTION_DISPLAY_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(), // default 20
});
export const adminInstitutionGetInput = z.object({ id: z.uuid() });
export const adminInstitutionCreateInput = z.object({
  code: z.string().trim().toUpperCase().max(64),
  name,
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  analysisDailyTokenLimit: tokenLimit.optional(),
});
export const adminInstitutionUpdateInput = z.object({
  id: z.uuid(),
  name: name.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  analysisDailyTokenLimit: tokenLimit.optional(),
});

export const adminAccountListInput = z.object({
  role: z.enum(["INSTITUTION", "ADMIN"]).optional(),
  institutionId: z.uuid().optional(),
});
export const adminAccountCreateInput = z.discriminatedUnion("role", [
  z.object({ role: z.literal("INSTITUTION"), institutionId: z.uuid(), email: staffEmail, displayName: name }),
  z.object({ role: z.literal("ADMIN"), email: staffEmail, displayName: name }),
]);
export const adminAccountUpdateInput = z.object({
  id: z.uuid(), // users.id
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  displayName: name.optional(),
  resetPassword: z.literal(true).optional(),
});
export const adminAccountDeleteInput = z.object({ id: z.uuid() });
