import { useRouter } from "expo-router";
import { View } from "react-native";
import { track } from "../../lib/analytics";
import { KeepsakeThumb, useFitScale } from "../../ui/KeepsakeThumb";
import { card as cardTokens } from "../../ui/theme";
import { keepsakeStrings as strings } from "./strings";
import { useGuideKeepsake } from "./useGuideKeepsake";

// The keepsake card as the main visual of Archive Detail: the saved snapshot, else today's live preview.
// Full width up to the card's own size, centred; tapping it opens the editor.
export function KeepsakeHero({ code, exhibition }: { code: string; exhibition: Parameters<typeof useGuideKeepsake>[1] }) {
  const router = useRouter();
  const k = useGuideKeepsake(code, exhibition);
  const { onLayout, scale } = useFitScale();
  const open = () => {
    track("keepsake_open", { exhibition_code: code, source: "archive" });
    router.push(`/archive/${code}/keepsake?from=archive`);
  };
  return (
    <View onLayout={onLayout} style={{ width: "100%", maxWidth: cardTokens.width, alignSelf: "center" }}>
      {scale > 0 && (
        <KeepsakeThumb
          scale={scale}
          card={k.card}
          templateId={k.templateId}
          placeholder={k.state === "guest" || k.state === "empty" ? strings.placeholder : undefined}
          entering={k.entering}
          accessibilityLabel="Your keepsake card — edit"
          accessibilityHint="Opens the card editor."
          onPress={open}
        />
      )}
    </View>
  );
}
