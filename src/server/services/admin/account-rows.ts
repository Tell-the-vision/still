import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { institutions, userTokens, users } from "../../db/schema";

// One institution or operator account as STILL Admin sees it (SPEC §9.5 admin.account.*): the users
// row plus its PASSWORD identity. Never includes the password hash.
export type AccountRow = {
  id: string; // users.id
  role: "INSTITUTION" | "ADMIN";
  institution: { id: string; code: string; name: string } | null;
  email: string;
  displayName: string | null;
  status: "ACTIVE" | "SUSPENDED";
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

const iso = (date: Date | null) => date?.toISOString() ?? null;

// Staff accounts matching `where`, oldest first.
export async function accountRows(where?: SQL): Promise<AccountRow[]> {
  const rows = await db
    .select({ user: users, identity: userTokens, institution: institutions })
    .from(users)
    .innerJoin(userTokens, and(eq(userTokens.userId, users.id), eq(userTokens.provider, "PASSWORD")))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .where(and(inArray(users.role, ["INSTITUTION", "ADMIN"]), where ?? sql`true`))
    .orderBy(asc(users.createdAt), asc(users.id));
  return rows.map(({ user, identity, institution }) => ({
    id: user.id,
    role: user.role as AccountRow["role"],
    institution: institution && { id: institution.id, code: institution.code, name: institution.name },
    email: identity.subject,
    displayName: identity.displayName,
    status: user.status as AccountRow["status"],
    mustChangePassword: identity.mustChangePassword,
    lockedUntil: iso(identity.lockedUntil),
    lastLoginAt: iso(identity.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
  }));
}
