import { Pressable, View } from "react-native";
import { KeepsakeCard } from "./KeepsakeCard";
import { card as cardTokens, focusRing } from "./theme";
import { useState, type ComponentProps } from "react";

// Phone size; desktop passes a larger scale so the card leads its panel.
export const THUMB_SCALE = 0.45;
export const thumbHeight = (scale: number) => (cardTokens.width / cardTokens.aspectRatio) * scale;

type Props = Pick<ComponentProps<typeof KeepsakeCard>, "card" | "templateId" | "placeholder" | "entering"> & { onPress: () => void; scale?: number };

// The card at 0.45 scale as one button; nothing inside it takes focus.
export function KeepsakeThumb({ onPress, scale = THUMB_SCALE, ...card }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your keepsake card"
      accessibilityHint="Shows the card at full size."
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[{ width: cardTokens.width * scale, height: thumbHeight(scale), overflow: "hidden" }, focused && focusRing]}
    >
      <View aria-hidden pointerEvents="none" style={{ width: cardTokens.width, transform: [{ scale }], transformOrigin: "top left" }}>
        <KeepsakeCard {...card} accessibilityLabel="Keepsake preview" />
      </View>
    </Pressable>
  );
}
