import { useEffect } from "react";
import { useMe, useUserState } from "../features/auth/use-me";
import { track } from "../lib/analytics";
import { CurrentExhibition } from "../features/home/CurrentExhibition";
import { homeStrings } from "../features/home/strings";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { Wordmark } from "../ui/Wordmark";

// Home 01 (guest) has the login and QR scan entry points; Home 02 (signed in) adds the tab bar (SPEC §1.1).
export default function Home() {
  const me = useMe();
  const userState = useUserState();
  useEffect(() => {
    if (userState) track("home_view", { user_state: userState });
  }, [userState]);
  return (
    <Screen tabs={!!me} header={!!me} headerRight={!!me}>
      <Stack centered>
        <Wordmark />
        {me ? (
          <Text>{homeStrings.welcome}</Text>
        ) : (
          <Button label={homeStrings.login} href="/login?returnTo=/" variant="secondary" />
        )}
        {me && <CurrentExhibition />}
        <Button label={homeStrings.scan} href="/scan" />
      </Stack>
    </Screen>
  );
}
