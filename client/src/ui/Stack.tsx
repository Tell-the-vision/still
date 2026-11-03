import type { ReactNode } from "react";
import { View } from "react-native";
import { spacing } from "./theme";

type Props = {
  children: ReactNode;
  centered?: boolean;
  fill?: boolean;
  direction?: "column" | "row";
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  gap?: keyof typeof spacing;
};

// Layout with a token gap. A column is as tall as its content unless `centered` or `fill` makes it grow.
// `centered` centers the content on both axes.
export function Stack({ children, centered = false, fill = false, direction = "column", align, justify, gap = "gap" }: Props) {
  return (
    <View
      style={{
        flexDirection: direction,
        flex: direction === "column" && (centered || fill) ? 1 : undefined,
        gap: spacing[gap],
        alignItems: align ?? (centered ? "center" : undefined),
        justifyContent: justify ?? (centered ? "center" : undefined),
      }}
    >
      {children}
    </View>
  );
}
