import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { Stack } from "../../ui/Stack";
import { spacing } from "../../ui/theme";

// The keepsake's action line: Download PNG, Share PNG and, on Archive Detail, Delete.
// On web they are text actions on one line that wraps on narrow screens; native keeps its own stacked buttons.
export function KeepsakeActions({ align, children }: { align: "center" | "start"; children: ReactNode }) {
  if (Platform.OS !== "web") {
    return align === "center" ? (
      <Stack direction="row" gap="section" justify="center">
        {children}
      </Stack>
    ) : (
      <>{children}</>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: spacing.section,
        rowGap: spacing.inset,
      }}
    >
      {children}
    </View>
  );
}
