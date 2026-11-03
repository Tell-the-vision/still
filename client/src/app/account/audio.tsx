import { StyleSheet, View } from "react-native";
import { AudioSettings } from "../../features/audio/AudioSettings";
import { audioStrings } from "../../features/audio/strings";
import { useRequireLogin } from "../../features/auth/require-login";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { spacing } from "../../ui/theme";

// SPEC §6.1: the saved audio choice.
export default function Audio() {
  const me = useRequireLogin("/account");
  return (
    <Screen tabs>
      {me ? (
        <View style={styles.body}>
          <TextAction href="/account" label={audioStrings.back} leading="←" variant="secondary" />
          <Text variant="headline">{audioStrings.headline}</Text>
          <AudioSettings />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.gap, paddingTop: spacing.gap } });
