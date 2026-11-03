import { AccessibilityInfo, Platform } from "react-native";

// Announces to screen readers: a polite live region on web, the native announcement elsewhere.
export function announce(message: string) {
  if (Platform.OS !== "web") return AccessibilityInfo.announceForAccessibility(message);
  const region = document.createElement("div");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("role", "status");
  region.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
  document.body.appendChild(region);
  // The text is set after insertion so the change is announced.
  setTimeout(() => (region.textContent = message), 50);
  setTimeout(() => region.remove(), 5000);
}
