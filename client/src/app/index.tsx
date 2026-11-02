import { StyleSheet, View } from "react-native";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Wordmark } from "../ui/Wordmark";
import { spacing } from "../ui/theme";

// Home 01 (SPEC §1.1): wordmark with login and QR scan entry points. No tab bar.
export default function Home() {
  return (
    <Screen>
      <View style={styles.center}>
        <Wordmark />
        <Button label="Login" href="/login?returnTo=/" variant="secondary" />
        <Button label="QR Scan" href="/scan" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.gap },
});
