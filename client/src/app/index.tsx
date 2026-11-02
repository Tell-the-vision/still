import { StyleSheet, View } from "react-native";
import { useMe } from "../features/auth/use-me";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { Wordmark } from "../ui/Wordmark";
import { spacing } from "../ui/theme";

// Home 01 (guest) has the login and QR scan entry points; Home 02 (signed in) adds the tab bar (SPEC §1.1).
export default function Home() {
  const me = useMe();
  return (
    <Screen tabs={!!me} headerRight={!!me}>
      <View style={styles.center}>
        <Wordmark />
        {me ? (
          <Text>Welcome back.</Text>
        ) : (
          <Button label="Login" href="/login?returnTo=/" variant="secondary" />
        )}
        <Button label="QR Scan" href="/scan" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.gap },
});
