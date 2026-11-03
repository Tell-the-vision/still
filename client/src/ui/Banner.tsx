import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Notice } from "./Notice";
import { uiStrings } from "./strings";
import { colors, spacing } from "./theme";

type Props = { message: string; error?: boolean; dismissible?: boolean };

// A global notice that stays inside the safe area and shares the screen gutter. Dismissing hides it locally.
export function Banner({ message, error = false, dismissible = true }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const action = dismissible ? { label: uiStrings.dismiss, onPress: () => setDismissed(true) } : undefined;
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: colors.white, paddingHorizontal: spacing.gutter }}>
      <Notice message={message} error={error} action={action} />
    </SafeAreaView>
  );
}
