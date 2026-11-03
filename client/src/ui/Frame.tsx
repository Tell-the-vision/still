import type { ReactNode } from "react";
import { View } from "react-native";
import { colors, rule, spacing } from "./theme";

// A placeholder box: a 1px black outline, or a solid placeholder fill (the artwork stand-in).
export function Frame({ aspectRatio, tone = "outline", children }: { aspectRatio: number; tone?: "outline" | "solid"; children?: ReactNode }) {
  return (
    <View style={{ aspectRatio, alignItems: "center", justifyContent: "center", padding: spacing.gap, borderWidth: rule, borderColor: colors.black, backgroundColor: tone === "solid" ? colors.placeholder : undefined }}>
      {children}
    </View>
  );
}
