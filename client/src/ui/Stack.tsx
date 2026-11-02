import type { ReactNode } from "react";
import { View } from "react-native";
import { spacing } from "./theme";

// Vertical layout with the standard gap; `centered` centers the content on both axes.
export function Stack({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return <View style={[{ flex: 1, gap: spacing.gap }, centered && { alignItems: "center", justifyContent: "center" }]}>{children}</View>;
}
