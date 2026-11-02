import AsyncStorage from "@react-native-async-storage/async-storage";

// The app has no session-scoped storage, so both stores share AsyncStorage (SPEC §0.1).
const store = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  keys: async () => [...(await AsyncStorage.getAllKeys())],
};
export const sessionStore = store;
export const localStore = store;
