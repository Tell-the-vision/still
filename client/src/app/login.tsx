import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { authStrings } from "../features/auth/strings";
import { isInAppBrowser } from "../features/auth/in-app-browser";
import { peekPendingAction } from "../features/auth/pending-action";
import { clearLoginStarted, markLoginStarted } from "../features/auth/useLoginSuccess";
import { track } from "../lib/analytics";
import { useGoogleAuthCode } from "../features/auth/use-google-auth";
import { tokenStorage } from "../features/auth/token-storage";
import { PUBLIC_PATHS, queryPath, useTRPCClient } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { TextAction } from "../ui/TextAction";

// Login (SPEC §2.2 Sign in). Web starts the OAuth Route; native runs PKCE and calls session.create.
export default function Login() {
  const { returnTo = "/" } = useLocalSearchParams<{ returnTo?: string }>();
  const isWeb = Platform.OS === "web";
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpcClient = useTRPCClient();
  const google = useGoogleAuthCode();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const signInNative = async () => {
    setPending(true);
    setFailed(false);
    try {
      const credentials = await google.start();
      if (!credentials) return;
      const session = await trpcClient.session.create.mutate(credentials);
      await tokenStorage.save(session);
      await clearLoginStarted();
      track("login_success", { provider: "GOOGLE" });
    } catch {
      setFailed(true);
      return;
    } finally {
      setPending(false);
    }
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (q) => !PUBLIC_PATHS.includes(queryPath(q.queryKey)) });
    router.replace(returnTo as never);
  };
  const webUrl = `/api/auth/google?${new URLSearchParams({ intent: "sign_in", returnTo })}`;
  const startGoogle = async () => {
    track("login_start", { source_action: (await peekPendingAction())?.kind ?? "login" });
    await markLoginStarted();
    if (isWeb) window.location.assign(webUrl);
    else await signInNative();
  };
  const inApp = isWeb && isInAppBrowser();
  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
  };
  const notNow = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <Screen>
      <Stack>
        {failed && <Notice error message={authStrings.failed} />}
        <Text variant="headline">{inApp ? authStrings.openTitle : authStrings.title}</Text>
        <Text variant="secondary">{inApp ? authStrings.openInBrowser : authStrings.loginBody}</Text>
        {inApp ? (
          <>
            <Button label={authStrings.copyLink} onPress={copyLink} />
            {copied && <Notice message={authStrings.linkCopied} />}
          </>
        ) : (
          <>
            <Button label={authStrings.continueWithGoogle} onPress={startGoogle} disabled={pending || (!isWeb && !google.ready)} />
            <TextAction variant="secondary" label={authStrings.notNow} trailing="→" onPress={notNow} />
          </>
        )}
      </Stack>
    </Screen>
  );
}
