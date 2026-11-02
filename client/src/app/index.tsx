import { useMe } from "../features/auth/use-me";
import { homeStrings } from "../features/home/strings";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { Wordmark } from "../ui/Wordmark";

// Home 01 (guest) has the login and QR scan entry points; Home 02 (signed in) adds the tab bar (SPEC §1.1).
export default function Home() {
  const me = useMe();
  return (
    <Screen tabs={!!me} headerRight={!!me}>
      <Stack centered>
        <Wordmark />
        {me ? (
          <Text>{homeStrings.welcome}</Text>
        ) : (
          <Button label={homeStrings.login} href="/login?returnTo=/" variant="secondary" />
        )}
        <Button label={homeStrings.scan} href="/scan" />
      </Stack>
    </Screen>
  );
}
