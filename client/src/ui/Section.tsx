import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { spacing } from "./theme";

// A labelled group of content; the label is a heading for screen readers.
export function Section({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <View style={{ alignSelf: "stretch" }}>
      <Text variant="eyebrow" role="heading" style={{ marginBottom: spacing.inset }}>{label}</Text>
      {children}
    </View>
  );
}
