// Native sign-in reuses the web OAuth client: Google redirects to this relay, which hands the code to the app.
export const relayUrl = () => `${process.env.STILL_ORIGIN}/api/auth/google/native-callback`;

// Exact return URLs only: the app's scheme, plus the Expo Go redirect outside production.
export function isAllowedAppReturnUrl(value: string | null): value is string {
  if (!value) return false;
  return value === "still://oauthredirect" || (process.env.NODE_ENV !== "production" && /^exp:\/\/[A-Za-z0-9.:-]+\/--\/oauthredirect$/.test(value));
}
