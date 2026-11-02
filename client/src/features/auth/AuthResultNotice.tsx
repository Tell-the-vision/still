import { useQueryClient } from "@tanstack/react-query";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTRPC } from "../../lib/trpc";
import { Banner } from "../../ui/Banner";
import { authStrings } from "./strings";

type Notice = { message: string; error: boolean };
const authMessages: Record<string, string> = { cancelled: authStrings.cancelled, failed: authStrings.failed };
const linkMessages: Record<string, string> = authStrings.link;

// Shows the OAuth callback result (?auth=cancelled|failed or ?link=created|exists|conflict|failed), then strips the params.
export function AuthResultNotice() {
  const { auth, link } = useGlobalSearchParams<{ auth?: string; link?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!auth && !link) return;
    const message = (link && linkMessages[link]) || (auth && authMessages[auth]) || null;
    setNotice(message ? { message, error: auth === "failed" || link === "failed" || link === "conflict" } : null);
    if (link) {
      void queryClient.invalidateQueries({ queryKey: trpc.identity.pathKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.me.pathKey() });
    }
    router.replace({ pathname, params: { auth: undefined, link: undefined } }); // setParams in the layout would not reach the screen
  }, [auth, link, pathname, router, queryClient, trpc]);
  return notice ? <Banner message={notice.message} error={notice.error} /> : null;
}
