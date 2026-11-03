import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { spacing } from "./theme";

// A labelled group of content; the label is a heading for screen readers.
export function Section({ label, labelVariant = "eyebrow", hideLabel = false, children }: { label: string; labelVariant?: "eyebrow" | "row"; hideLabel?: boolean; children?: ReactNode }) {
  return (
    <View style={{ alignSelf: "stretch" }}>
      {!hideLabel && <Text variant={labelVariant} role="heading" style={{ marginBottom: spacing.inset }}>{label}</Text>}
      {children}
    </View>
  );
}
