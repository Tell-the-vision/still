/**
 * Analytics events (spec §15). This is a thin hook point: events are pushed
 * to `window.dataLayer` (GTM-compatible) and logged in development.
 * Never include journal text, emails or other personal content.
 */
export type AnalyticsEvent =
  | "home_view"
  | "qr_scan_start"
  | "exhibition_view"
  | "login_start"
  | "login_success"
  | "scrap_save"
  | "scrap_remove"
  | "journal_create"
  | "journal_update"
  | "audio_external_click"
  | "ambience_on"
  | "ambience_off"
  | "keepsake_save"
  | "keepsake_png_download"
  | "archive_delete";

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const payload = { event, ...props, ts: Date.now() };
  try {
    (window.dataLayer ??= []).push(payload);
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", payload);
  }
}
