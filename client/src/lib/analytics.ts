import Constants from "expo-constants";
import { Platform } from "react-native";

// SPEC §11.6 events. Props are codes, ids and enums only: never content, email or the ticket URL.
type UserState = "guest" | "signed_in";
type Events = {
  home_view: { user_state: UserState };
  qr_scan_start: { user_state: UserState };
  exhibition_view: { exhibition_code: string };
  login_start: { source_action: string };
  login_success: { provider: "GOOGLE" };
};

declare global {
  interface Window {
    dataLayer?: object[];
  }
}

export function track<N extends keyof Events>(name: N, props: Events[N]) {
  const event = { event: name, ...props, platform: Platform.OS, app_version: Constants.expoConfig?.version };
  if (Platform.OS === "web") window.dataLayer?.push(event);
  else if (__DEV__) console.debug(event);
}
