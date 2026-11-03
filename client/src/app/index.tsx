import { useEffect } from "react";
import { View } from "react-native";
import { useMe, useUserState } from "../features/auth/use-me";
import { track } from "../lib/analytics";
import { Exhibitions } from "../features/home/Exhibitions";
import { homeStrings } from "../features/home/strings";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { TextAction } from "../ui/TextAction";
import { useCanScan } from "../ui/useCanScan";
import { useWide } from "../ui/useWide";
import { Wordmark } from "../ui/Wordmark";

// Home 01 (guest) has the login and QR scan entry points; Home 02 (signed in) adds the tab bar (SPEC §1.1).
export default function Home() {
  const me = useMe();
  const userState = useUserState();
  const canScan = useCanScan();
  // Desktop guests have no QR entry, so they get the exhibition list.
  const wide = useWide();
  useEffect(() => {
    if (userState) track("home_view", { user_state: userState });
  }, [userState]);
  if (me) {
    return (
      <Screen tabs width="wide">
        <Stack gap="section">
          <Stack gap="tight">
            <Text variant="headline">{homeStrings.welcome}</Text>
            <Text variant="secondary">{homeStrings.tagline}</Text>
          </Stack>
          <Exhibitions />
        </Stack>
      </Screen>
    );
  }
  return (
    <Screen header={false} width={wide ? "wide" : undefined}>
      <Stack centered gap="section">
        <Wordmark size="hero" />
        <Stack gap="section" align="flex-start">
          <TextAction label={homeStrings.login} href="/login?returnTo=/" variant="subhead" mark="square" />
          {canScan && <TextAction label={homeStrings.scan} href="/scan" variant="subhead" mark="qr" />}
        </Stack>
        {wide && (
          <View style={{ alignSelf: "stretch" }}>
            <Exhibitions />
          </View>
        )}
      </Stack>
    </Screen>
  );
}
