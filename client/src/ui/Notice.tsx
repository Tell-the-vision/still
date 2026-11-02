import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, spacing } from "./theme";

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
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
      <Text variant="body">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.black, padding: spacing.inset },
});
