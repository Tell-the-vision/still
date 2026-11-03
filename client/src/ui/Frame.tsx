import type { ReactNode } from "react";
import { View } from "react-native";
import { colors, rule, spacing } from "./theme";

// A 1px black outline with centred content, for empty and loading placeholders only.
export function Frame({ aspectRatio, children }: { aspectRatio: number; children?: ReactNode }) {
  return (
    <View style={{ aspectRatio, alignItems: "center", justifyContent: "center", padding: spacing.gap, borderWidth: rule, borderColor: colors.black }}>
      {children}
    </View>
  );
}
