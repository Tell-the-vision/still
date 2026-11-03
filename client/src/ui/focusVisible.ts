import { Platform } from "react-native";

// Focus-visible on web: the focus ring shows for keyboard navigation only. Taps and clicks also move
// focus in browsers, and a ring left behind after a tap reads as a glitch.
let keyboard = false;
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboard = true;
  }, true);
  for (const type of ["pointerdown", "mousedown", "touchstart"]) {
    window.addEventListener(type, () => {
      keyboard = false;
    }, true);
  }
}

export const focusVisible = () => Platform.OS !== "web" || keyboard;
