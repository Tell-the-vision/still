import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

// Native Google PKCE: `start()` resolves to the credentials to send to the server, or null when cancelled.
export function useGoogleAuthCode() {
  const redirectUri = AuthSession.makeRedirectUri({ path: "oauthredirect" });
  const clientId = (Platform.OS === "ios" ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ?? "";
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId, scopes: ["openid", "email", "profile"], redirectUri },
    AuthSession.useAutoDiscovery("https://accounts.google.com"),
  );
  const start = async () => {
    const result = await promptAsync();
    if (result.type !== "success" || !request?.codeVerifier) return null;
    return { provider: "GOOGLE" as const, code: result.params.code, codeVerifier: request.codeVerifier, redirectUri };
  };
  return { ready: !!request, start };
}
