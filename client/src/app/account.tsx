import { StyleSheet, View } from "react-native";
import { useRequireLogin } from "../features/auth/require-login";
import { useSignOut } from "../features/auth/sign-out";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { spacing } from "../ui/theme";

const providerNames: Record<string, string> = { GOOGLE: "GOOGLE" };

// Account (Figma 09, SPEC §2.2 Profile).
export default function Account() {
  const me = useRequireLogin("/account");
  const signOut = useSignOut();
  if (!me) return <Screen tabs headerRight>{null}</Screen>;
  return (
    <Screen tabs headerRight>
      <View style={styles.sections}>
        <View>
          <Text variant="label">SIGNED IN WITH {providerNames[me.provider] ?? me.provider}</Text>
          <Text>{me.displayName}</Text>
          <Text>{me.email}</Text>
        </View>
        <View>
          <Text variant="label">PREFERENCES</Text>
        </View>
        <View>
          <Text variant="label">ABOUT STILL</Text>
          <Text>Art stays with you.</Text>
          <Text>A quiet place for what remains after the exhibition ends.</Text>
        </View>
        <View>
          <Text variant="label">ACCOUNT</Text>
          <Button label="Log out →" variant="secondary" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { flex: 1, gap: spacing.gap, paddingTop: spacing.gap },
});
