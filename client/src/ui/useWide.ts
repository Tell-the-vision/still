import { Platform, useWindowDimensions } from "react-native";

// Desktop web: the wide layout with the top nav and no QR entry points. Native and narrow web use the phone layout.
export const WIDE_MIN_WIDTH = 1024;

export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WIDE_MIN_WIDTH;
}
