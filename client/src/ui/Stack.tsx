import type { ReactNode } from "react";
import { View } from "react-native";
import { spacing } from "./theme";

type Props = {
  children: ReactNode;
  centered?: boolean;
  direction?: "column" | "row";
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  gap?: keyof typeof spacing;
};

// Layout with a token gap. A column fills its parent; a row does not flex.
// `centered` centers the content on both axes.
export function Stack({ children, centered = false, direction = "column", align, justify, gap = "gap" }: Props) {
  return (
    <View
      style={{
        flexDirection: direction,
        flex: direction === "column" ? 1 : undefined,
        gap: spacing[gap],
        alignItems: align ?? (centered ? "center" : undefined),
        justifyContent: justify ?? (centered ? "center" : undefined),
      }}
    >
      {children}
    </View>
  );
}
