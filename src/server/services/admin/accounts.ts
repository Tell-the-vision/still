import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { adminAccountUpdateInput } from "@still/shared/admin";
import { hashPassword, temporaryPassword } from "../../auth/password";
import { db } from "../../db/client";
import { userSessions, userTokens, users } from "../../db/schema";
import { AppError } from "../../trpc/init";
import { accountRows } from "./account-rows";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A staff account (operator or institution): VISITOR users are not STILL Admin's to manage.
async function findStaffAccount(tx: Tx, id: string) {
  const [account] = await tx
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(and(eq(users.id, id), inArray(users.role, ["INSTITUTION", "ADMIN"])));
  if (!account) throw new TRPCError({ code: "NOT_FOUND" });
  return account;
}

// SPEC §10.5 첫 운영자: STILL always keeps one ACTIVE operator. Lock every ACTIVE operator (in id
// order, so concurrent callers queue instead of deadlocking) before counting: a second operator
// suspending the other waits here, then sees the committed status and counts one.
async function assertNotLastOperator(tx: Tx, account: { id: string; role: string; status: string }) {
  if (account.role !== "ADMIN" || account.status !== "ACTIVE") return;
  const active = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.status, "ACTIVE")))
    .orderBy(asc(users.id))
    .for("update");
  if (active.length === 1 && active[0].id === account.id) {
    throw new TRPCError({ code: "CONFLICT", cause: new AppError("LAST_ADMIN") });
  }
}

// admin.account.update (SPEC §9.2 정지·재개·재설정): the requested changes commit together.
// The temporary password is returned once and never stored in clear.
export async function updateAccount(input: z.infer<typeof adminAccountUpdateInput>) {
  let newPassword: string | null = null;
  await db.transaction(async (tx) => {
    const account = await findStaffAccount(tx, input.id);
    if (input.status === "SUSPENDED") await assertNotLastOperator(tx, account);
    const endsSessions = input.status === "SUSPENDED" || input.resetPassword;

    if (input.status) await tx.update(users).set({ status: input.status }).where(eq(users.id, input.id));

    const identity: Partial<typeof userTokens.$inferInsert> = {};
    if (input.displayName !== undefined) identity.displayName = input.displayName;
    if (input.resetPassword) {
      newPassword = temporaryPassword();
      Object.assign(identity, {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      });
    }
    if (Object.keys(identity).length > 0) {
      await tx.update(userTokens).set(identity).where(and(eq(userTokens.userId, input.id), eq(userTokens.provider, "PASSWORD")));
    }
    if (endsSessions) await tx.delete(userSessions).where(eq(userSessions.userId, input.id));
  });
  const [row] = await accountRows(eq(users.id, input.id));
  return { account: row, temporaryPassword: newPassword };
}

// admin.account.delete: the identity and sessions go by cascade; rows the account created keep a NULL author.
export async function deleteAccount(id: string) {
  await db.transaction(async (tx) => {
    await assertNotLastOperator(tx, await findStaffAccount(tx, id));
    await tx.delete(users).where(eq(users.id, id));
  });
}

