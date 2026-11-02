import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "../../ui/Text";
import { authStrings } from "./strings";

const messages: Record<string, string> = { cancelled: authStrings.cancelled, failed: authStrings.failed };

// Shows the OAuth callback result (?auth=cancelled|failed), then strips the param from the URL.
export function AuthResultNotice() {
  const { auth } = useGlobalSearchParams<{ auth?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!auth) return;
    setMessage(messages[auth] ?? null);
    router.replace({ pathname, params: { auth: undefined } }); // setParams in the layout would not reach the screen
  }, [auth, pathname, router]);
  return message ? <Text>{message}</Text> : null;
}
