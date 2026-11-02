/**
 * Auth.js (next-auth v5) configuration.
 *
 *  - Google OAuth is the only real provider (PRD §6.2).
 *  - When Google credentials are missing (or ENABLE_DEV_LOGIN=true) a
 *    password-less "Dev Login" provider is exposed so the team can run the
 *    app without a Google Cloud project. Never enable it in production.
 *  - Sessions are JWTs. On first sign-in we upsert our own `users` row and
 *    put its id on the token (`session.user.id`).
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(googleId && googleSecret);
/**
 * Dev Login is on automatically in development when Google is not configured.
 * In production it is OFF unless ENABLE_DEV_LOGIN=true is set explicitly
 * (useful for a throw-away demo deploy — never for real users).
 */
export const devLoginEnabled =
  process.env.ENABLE_DEV_LOGIN === "true" ||
  (process.env.NODE_ENV !== "production" && !googleEnabled);

/** Emails listed in ADMIN_EMAILS (comma-separated) are promoted to ADMIN on sign-in. */
export function isBootstrapAdmin(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

async function upsertUser(input: {
  googleId: string;
  email: string;
  displayName: string;
  image?: string | null;
}) {
  const promote = isBootstrapAdmin(input.email);
  const existing = await db.query.users.findFirst({
    where: eq(users.googleId, input.googleId),
  });
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: input.email,
        displayName: input.displayName || existing.displayName,
        image: input.image ?? existing.image,
        ...(promote && existing.role !== "ADMIN" ? { role: "ADMIN" as const } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(users)
    .values({
      googleId: input.googleId,
      email: input.email,
      displayName: input.displayName,
      image: input.image ?? null,
      role: promote ? "ADMIN" : "USER",
    })
    .returning();
  return created;
}

const providers: NextAuthConfig["providers"] = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        const name = String(credentials?.name ?? "").trim() || email.split("@")[0];
        return { id: `dev:${email}`, email, name, image: null };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? "still-dev-secret-change-me" : undefined),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Runs with `user` only on the sign-in request (Node runtime, DB ok).
      if (user) {
        const provider = account?.provider ?? "dev";
        const externalId =
          provider === "google"
            ? String(profile?.sub ?? account?.providerAccountId ?? user.id)
            : String(user.id);
        const row = await upsertUser({
          googleId: externalId,
          email: user.email ?? `${externalId}@unknown.local`,
          displayName: user.name ?? "",
          image: user.image ?? null,
        });
        token.uid = row.id;
        token.name = row.displayName;
        token.email = row.email;
        token.picture = row.image ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
