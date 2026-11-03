import { Pressable, View } from "react-native";
import { KeepsakeCard } from "./KeepsakeCard";
import { card as cardTokens, focusRing } from "./theme";
import { useState, type ComponentProps } from "react";

const DEFAULT_SCALE = 0.45;

type Props = Pick<ComponentProps<typeof KeepsakeCard>, "card" | "templateId" | "placeholder" | "entering"> & { onPress: () => void; scale?: number };

// The card at 0.45 scale as one button; nothing inside it takes focus.
export function KeepsakeThumb({ onPress, scale = DEFAULT_SCALE, ...card }: Props) {
  const [focused, setFocused] = useState(false);
  const width = cardTokens.width * scale;
  const height = (cardTokens.width / cardTokens.aspectRatio) * scale;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your keepsake card"
      accessibilityHint="Shows the card at full size."
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[{ width, height, overflow: "hidden" }, focused && focusRing]}
    >
      <View aria-hidden pointerEvents="none" style={{ width: cardTokens.width, transform: [{ scale }], transformOrigin: "top left" }}>
        <KeepsakeCard {...card} accessibilityLabel="Keepsake preview" />
      </View>
    </Pressable>
  );
}
