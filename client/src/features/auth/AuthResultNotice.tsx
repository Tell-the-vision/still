import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Banner } from "../../ui/Banner";
import { authStrings } from "./strings";

type AuthResult = "cancelled" | "failed";
const messages: Record<AuthResult, string> = { cancelled: authStrings.cancelled, failed: authStrings.failed };

// Shows the OAuth callback result (?auth=cancelled|failed), then strips the param from the URL.
export function AuthResultNotice() {
  const { auth } = useGlobalSearchParams<{ auth?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [result, setResult] = useState<AuthResult | null>(null);
  useEffect(() => {
    if (!auth) return;
    setResult(auth === "cancelled" || auth === "failed" ? auth : null);
    router.replace({ pathname, params: { auth: undefined } }); // setParams in the layout would not reach the screen
  }, [auth, pathname, router]);
  return result ? <Banner message={messages[result]} error={result === "failed"} /> : null;
}
