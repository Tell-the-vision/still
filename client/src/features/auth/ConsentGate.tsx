import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTRPC } from "../../lib/trpc";
import { useMe } from "./use-me";

// Sends a signed-in user without consent to /consent (SPEC §2.2 Consent). A CONSENT_REQUIRED error also
// lands here, because it sets consent.get to null.
export function ConsentGate() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const consent = useQuery(trpc.consent.get.queryOptions(undefined, { enabled: !!me }));
  const missing = !!me && consent.data === null && pathname !== "/consent";
  useEffect(() => {
    if (missing) router.replace(`/consent?returnTo=${encodeURIComponent(pathname)}`);
  }, [missing, pathname, router]);
  return null;
}
