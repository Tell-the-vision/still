import { desc, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { institutions } from "../../db/schema";

// One institution as STILL Admin lists it (SPEC §9.2 기관 목록, Figma A9). Every admin.institution.*
// procedure returns this shape.
export type InstitutionRow = {
  id: string;
  code: string; // the institution ID staff type to sign in, e.g. STL-SEO-0001
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  // SUSPENDED when suspended; PENDING_SETUP while no account has ever signed in; otherwise ACTIVE.
  displayStatus: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  accountCount: number;
  // The institution's first account: who the operator issued the workspace to.
  workspaceAdmin: { accountId: string; email: string } | null;
  lastActiveAt: string | null; // latest last_login_at among its accounts
  analysisDailyTokenLimit: number | null;
  createdAt: string;
};

// Drizzle prints a column of a one-table select without its table, which inside these subqueries
// would resolve to users.id; the explicit name reaches the institution.
const institutionId = sql.raw('"institutions"."id"');
const accountsOf = sql`users u JOIN user_tokens t ON t.user_id = u.id AND t.provider = 'PASSWORD' WHERE u.institution_id = ${institutionId}`;

// created_at at the millisecond the API shows it, so ordering and the list cursor agree with it.
export const createdAtMs = sql`date_trunc('milliseconds', ${institutions.createdAt})`;

// WHERE fragment for one display status; the same definition as InstitutionRow.displayStatus.
export function displayStatusWhere(status: InstitutionRow["displayStatus"]): SQL {
  const signedIn = sql`EXISTS (SELECT 1 FROM ${accountsOf} AND t.last_login_at IS NOT NULL)`;
  if (status === "SUSPENDED") return sql`${institutions.status} = 'SUSPENDED'`;
  if (status === "PENDING_SETUP") return sql`(${institutions.status} = 'ACTIVE' AND NOT ${signedIn})`;
  return sql`(${institutions.status} = 'ACTIVE' AND ${signedIn})`;
}

// Institutions matching `where`, most recently added first (ties by id).
export async function institutionRows({ where, limit }: { where?: SQL; limit?: number } = {}): Promise<InstitutionRow[]> {
  const rows = await db
    .select({
      id: institutions.id,
      code: institutions.code,
      name: institutions.name,
      status: sql<InstitutionRow["status"]>`${institutions.status}`,
      accountCount: sql<number>`(SELECT count(*)::int FROM users u WHERE u.institution_id = ${institutionId})`,
      workspaceAdmin: sql<InstitutionRow["workspaceAdmin"]>`(SELECT json_build_object('accountId', u.id, 'email', t.email) FROM ${accountsOf} ORDER BY u.created_at, u.id LIMIT 1)`,
      lastActiveAt: sql<string | null>`(SELECT to_json(max(t.last_login_at)) #>> '{}' FROM ${accountsOf})`,
      analysisDailyTokenLimit: institutions.analysisDailyTokenLimit,
      createdAt: institutions.createdAt,
    })
    .from(institutions)
    .where(where)
    .orderBy(desc(createdAtMs), desc(institutions.id))
    .limit(limit ?? 10_000);
  return rows.map((row) => ({
    ...row,
    displayStatus: row.status === "SUSPENDED" ? "SUSPENDED" : row.lastActiveAt === null ? "PENDING_SETUP" : "ACTIVE",
    createdAt: row.createdAt.toISOString(),
  }));
}
