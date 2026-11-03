import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { TextAction } from "./TextAction";
import { colors, rule, spacing } from "./theme";

type Props = { message: string; error?: boolean; action?: { label: string; onPress: () => void } };

// A message set off by a black rule above it, with an optional text action.
export function Notice({ message, error = false, action }: Props) {
  // VoiceOver doesn't announce a newly mounted alert on its own.
  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View
      role={error ? "alert" : "status"}
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      style={styles.box}
    >
      <Text variant="action">{message}</Text>
      {action ? <TextAction label={action.label} onPress={action.onPress} trailing="→" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: rule, borderTopColor: colors.black, paddingTop: spacing.inset, gap: spacing.tight },
});
