import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { Montserrat_500Medium, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_600SemiBold, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";

SplashScreen.preventAutoHideAsync();

// Holds rendering until fonts load or fail, so text never flashes in a fallback face.
export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    Montserrat_500Medium,
    Montserrat_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
  });
  const ready = loaded || error !== null;
  useEffect(() => void (ready && SplashScreen.hideAsync()), [ready]);

  return ready ? <>{children}</> : null;
}
