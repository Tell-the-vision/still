import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { useMe } from "./use-me";

// Sends a signed-in user without consent, or with consent to older policy versions, to /consent
// (SPEC §2.2 Consent). A CONSENT_REQUIRED error also lands here, because it sets consent.get to null.
export function ConsentGate() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const consent = useQuery(trpc.consent.get.queryOptions(undefined, { enabled: !!me }));
  const policy = useQuery(trpc.policy.get.queryOptions(undefined, { enabled: !!me, staleTime: STALE_TIME.policy }));
  const outdated =
    !!consent.data && !!policy.data && (consent.data.termsVersion !== policy.data.termsVersion || consent.data.privacyVersion !== policy.data.privacyVersion);
  const missing = !!me && (consent.data === null || outdated) && pathname !== "/consent";
  useEffect(() => {
    if (missing) router.replace(`/consent?returnTo=${encodeURIComponent(pathname)}`);
  }, [missing, pathname, router]);
  return null;
}
