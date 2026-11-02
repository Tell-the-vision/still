"use client";

/**
 * Self-heals a stale session: the JWT cookie may outlive its user row
 * (e.g. after `npm run db:reset`, an admin deleting the account, or a DB
 * swap). Without this, pages that require a user bounce between /login and
 * the page forever. When the cookie says "logged in" but /api/users/me says
 * there is no such user, we sign out and land on Home.
 */
import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

export function SessionGuard() {
  const { status } = useSession();
  const checked = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || checked.current) return;
    checked.current = true;
    let alive = true;
    fetch("/api/users/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: unknown } | null) => {
        if (!alive || !d) return;
        if (d.user === null) void signOut({ redirectTo: "/?session=expired" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  return null;
}
