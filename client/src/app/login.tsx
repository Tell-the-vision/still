import { useQueryClient } from "@tanstack/react-query";
import * as AuthSession from "expo-auth-session";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { authStrings } from "../features/auth/strings";
import { isInAppBrowser } from "../features/auth/in-app-browser";
import { tokenStorage } from "../features/auth/token-storage";
import { PUBLIC_PATHS, queryPath, useTRPCClient } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { spacing } from "../ui/theme";

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
  const signInNative = async () => {
    const result = await promptAsync();
    if (result.type !== "success" || !request?.codeVerifier) return;
    const session = await trpcClient.session.create.mutate({ provider: "GOOGLE", code: result.params.code, codeVerifier: request.codeVerifier, redirectUri });
    await tokenStorage.save(session);
    await queryClient.cancelQueries();
    queryClient.removeQueries({ predicate: (q) => !PUBLIC_PATHS.includes(queryPath(q.queryKey)) });
    router.replace(returnTo as never);
  };
  const webUrl = `/api/auth/google?intent=sign_in&returnTo=${encodeURIComponent(returnTo)}`;
  const startGoogle = () => (isWeb ? window.location.assign(webUrl) : signInNative());
  const inApp = isWeb && isInAppBrowser();
  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="label">{authStrings.title}</Text>
        {inApp ? (
          <>
            <Notice message={authStrings.openInBrowser} />
            <Button label={authStrings.copyLink} onPress={() => navigator.clipboard.writeText(window.location.href)} />
          </>
        ) : (
          <Button label={authStrings.continueWithGoogle} onPress={startGoogle} disabled={!isWeb && !request} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.gap },
});
