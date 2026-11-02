import { useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { authStrings } from "../features/auth/strings";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { spacing } from "../ui/theme";

// Login (SPEC §2.2 Sign in). Web starts the OAuth Route; native sign-in arrives with session.create.
export default function Login() {
  const { returnTo = "/" } = useLocalSearchParams<{ returnTo?: string }>();
  const isWeb = Platform.OS === "web";
  const startGoogle = () =>
    window.location.assign(`/api/auth/google?intent=sign_in&returnTo=${encodeURIComponent(returnTo)}`);
  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="label">{authStrings.title}</Text>
        <Button label={isWeb ? authStrings.continueWithGoogle : authStrings.comingSoon} onPress={startGoogle} disabled={!isWeb} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.gap },
});
