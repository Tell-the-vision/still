import AsyncStorage from "@react-native-async-storage/async-storage";

// The app has no session-scoped storage, so both stores share AsyncStorage (SPEC §0.1).
export const sessionStore = AsyncStorage;
export const localStore = AsyncStorage;
