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
  scrap_save: { exhibition_code: string; sentence_id: string };
  scrap_remove: { exhibition_code: string; sentence_id: string };
  journal_create: { exhibition_code: string };
  journal_update: { exhibition_code: string };
  journal_delete: { exhibition_code: string };
  audio_external_click: { provider: string; exhibition_code: string };
  ambience_on: { exhibition_code: string };
  ambience_off: { exhibition_code: string };
  keepsake_save: { exhibition_code: string; template_id: string };
  keepsake_delete: { exhibition_code: string; template_id: string };
  keepsake_png_download: { exhibition_code: string };
  archive_delete: { exhibition_code: string };
  account_delete: Record<string, never>;
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
