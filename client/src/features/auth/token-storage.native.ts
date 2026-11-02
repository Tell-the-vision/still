import * as SecureStore from "expo-secure-store";

const KEYS = { accessToken: "still_access_token", refreshToken: "still_refresh_token" };
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

// SPEC §2.3: native app tokens live in the keychain/keystore.
export const tokenStorage = {
  getAccessToken: () => SecureStore.getItemAsync(KEYS.accessToken, options),
  getRefreshToken: () => SecureStore.getItemAsync(KEYS.refreshToken, options),
  save: async (tokens: { accessToken: string; refreshToken: string }) => {
    for (const [name, key] of Object.entries(KEYS)) await SecureStore.setItemAsync(key, tokens[name as keyof typeof KEYS], options);
  },
  clear: async () => {
    for (const key of Object.values(KEYS)) await SecureStore.deleteItemAsync(key, options);
  },
};
