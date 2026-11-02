import { SafeAreaView } from "react-native-safe-area-context";
import { Notice } from "./Notice";
import { colors, spacing } from "./theme";

// A global notice that stays inside the safe area and shares the screen gutter.
export function Banner({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: colors.white, paddingHorizontal: spacing.gutter }}>
      <Notice message={message} error={error} />
    </SafeAreaView>
  );
}
