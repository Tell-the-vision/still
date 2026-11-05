import { parseArgs } from "node:util";
import { TRPCError } from "@trpc/server";
import { db } from "../db/client";
import { createStaffAccount } from "../services/staff-accounts";
import { AppError } from "../trpc/init";

// The first STILL operator is made here after deploy; later ones in STILL Admin (SPEC §10.5 첫 운영자).
// Usage: npm run admin:create -- --email ops@still.example --name "Ops Name"
const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });

async function main() {
  if (!values.email || !values.name) throw new Error("Usage: npm run admin:create -- --email <work email> --name <display name>");
  const account = await createStaffAccount({ role: "ADMIN", email: values.email, displayName: values.name });
  // Shown once and never stored; the operator must change it at first sign-in.
  console.log(`Created operator ${account.email}\nTemporary password: ${account.temporaryPassword}`);
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    const appCode = e instanceof TRPCError && e.cause instanceof AppError ? e.cause.appCode : null;
    console.error(appCode === "LOGIN_ID_TAKEN" ? `${values.email} already has an account` : e);
    process.exit(1);
  });
