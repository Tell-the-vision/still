import { Platform } from "react-native";
import { useWide } from "./useWide";

// QR entry points are hidden only on desktop web with a mouse; phones, tablets (even wide, in landscape) and native keep them.
export function useCanScan() {
  const wide = useWide();
  if (Platform.OS !== "web") return true;
  return !(wide && window.matchMedia("(pointer: fine)").matches);
}
