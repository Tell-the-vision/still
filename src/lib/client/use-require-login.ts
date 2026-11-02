"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { loginUrl, savePendingAction, type PendingAction } from "./pending-action";
import { track } from "./analytics";

/**
 * `requireLogin(action)` — if the user is logged in, runs nothing and returns
 * true; otherwise stashes the pending action, redirects to /login and returns
 * false. Screens call it right before a save.
 */
export function useRequireLogin() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const requireLogin = useCallback(
    (action?: PendingAction): boolean => {
      if (status === "authenticated") return true;
      if (action) savePendingAction(action);
      const qs = search?.toString();
      const returnTo = qs ? `${pathname}?${qs}` : pathname;
      track("login_start", { source_action: action?.type ?? "unknown" });
      router.push(loginUrl(returnTo));
      return false;
    },
    [status, router, pathname, search],
  );

  return { requireLogin, isLoggedIn: status === "authenticated", status };
}
