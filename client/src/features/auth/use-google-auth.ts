import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

// No platform client ID: sign in through the server relay that uses the web OAuth client (PKCE end to end).
async function relayLogin() {
  const codeVerifier = base64url(Crypto.getRandomBytes(32));
  const challenge = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(codeVerifier));
  const state = base64url(Crypto.getRandomBytes(16));
  const returnUrl = Linking.createURL("oauthredirect");
  const query = new URLSearchParams({ returnUrl, codeChallenge: base64url(new Uint8Array(challenge)), state });
  const result = await WebBrowser.openAuthSessionAsync(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/google/native-start?${query}`, returnUrl);
  if (result.type !== "success") return null;
  const params = new URL(result.url).searchParams;
  const code = params.get("code");
  if (!code || params.get("state") !== state) return null;
  return { provider: "GOOGLE" as const, code, codeVerifier, redirectUri: `${process.env.EXPO_PUBLIC_STILL_ORIGIN}/api/auth/google/native-callback` };
}

// Native Google PKCE: `start()` resolves to the credentials to send to the server, or null when cancelled.
export function useGoogleAuthCode() {
  const redirectUri = AuthSession.makeRedirectUri({ path: "oauthredirect" });
  const clientId = (Platform.OS === "ios" ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ?? "";
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId, scopes: ["openid", "email", "profile"], redirectUri },
    AuthSession.useAutoDiscovery("https://accounts.google.com"),
  );
  const start = async () => {
    if (!clientId) return relayLogin();
    const result = await promptAsync();
    if (result.type !== "success" || !request?.codeVerifier) return null;
    return { provider: "GOOGLE" as const, code: result.params.code, codeVerifier: request.codeVerifier, redirectUri };
  };
  return { ready: !clientId || !!request, start };
}
