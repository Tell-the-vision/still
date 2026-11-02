import { useQueryClient } from "@tanstack/react-query";
import * as AuthSession from "expo-auth-session";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { authStrings } from "../features/auth/strings";
import { isInAppBrowser } from "../features/auth/in-app-browser";
import { tokenStorage } from "../features/auth/token-storage";
import { PUBLIC_PATHS, queryPath, useTRPCClient } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";

// Login (SPEC §2.2 Sign in). Web starts the OAuth Route; native runs PKCE and calls session.create.
export default function Login() {
  const { returnTo = "/" } = useLocalSearchParams<{ returnTo?: string }>();
  const isWeb = Platform.OS === "web";
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpcClient = useTRPCClient();
  const redirectUri = AuthSession.makeRedirectUri({ path: "oauthredirect" });
  const clientId = (Platform.OS === "ios" ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ?? "";
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId, scopes: ["openid", "email", "profile"], redirectUri },
    AuthSession.useAutoDiscovery("https://accounts.google.com"),
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const signInNative = async () => {
    setPending(true);
    setFailed(false);
    try {
      const result = await promptAsync();
      if (result.type !== "success" || !request?.codeVerifier) return;
      const session = await trpcClient.session.create.mutate({ provider: "GOOGLE", code: result.params.code, codeVerifier: request.codeVerifier, redirectUri });
      await tokenStorage.save(session);
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
  const startGoogle = () => (isWeb ? window.location.assign(webUrl) : signInNative());
  const inApp = isWeb && isInAppBrowser();
  return (
    <Screen>
      <Stack centered>
        {failed && <Notice error message={authStrings.failed} />}
        <Text variant="label" role="heading">{authStrings.title}</Text>
        {inApp ? (
          <>
            <Notice message={authStrings.openInBrowser} />
            <Button label={authStrings.copyLink} onPress={() => navigator.clipboard?.writeText(window.location.href).catch(() => undefined)} />
          </>
        ) : (
          <Button label={authStrings.continueWithGoogle} onPress={startGoogle} disabled={pending || (!isWeb && !request)} />
        )}
      </Stack>
    </Screen>
  );
}
