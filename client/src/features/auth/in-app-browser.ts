const IN_APP_BROWSER = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps/i;

// Google rejects OAuth inside in-app webviews, so Login asks for the default browser instead (SPEC §2.2).
export function isInAppBrowser(): boolean {
  return typeof navigator !== "undefined" && IN_APP_BROWSER.test(navigator.userAgent);
}
