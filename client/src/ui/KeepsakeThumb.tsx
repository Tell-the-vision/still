import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { KeepsakeCard } from "./KeepsakeCard";
import { card as cardTokens, focusRing } from "./theme";
import { useState, type ComponentProps } from "react";

// Phone size; desktop passes a larger scale so the card leads its panel.
export const THUMB_SCALE = 0.45;
export const thumbHeight = (scale: number) => (cardTokens.width / cardTokens.aspectRatio) * scale;

// The scale that fits the card into its container's measured width (never above `max`), so the layout stays exact.
export function useFitScale(max = 1) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return { onLayout, scale: Math.min(width / cardTokens.width, max) };
}

type CardProps = Pick<ComponentProps<typeof KeepsakeCard>, "card" | "templateId" | "placeholder" | "entering">;

// A non-interactive miniature for use inside another link (the archive grid).
export function KeepsakeMini({ scale, ...card }: CardProps & { scale: number }) {
  if (scale <= 0) return null;
  return (
    <View aria-hidden pointerEvents="none" style={{ width: cardTokens.width * scale, height: thumbHeight(scale), overflow: "hidden" }}>
      <View style={{ width: cardTokens.width, transform: [{ scale }], transformOrigin: "top left" }}>
        <KeepsakeCard {...card} accessibilityLabel="Keepsake preview" />
      </View>
    </View>
  );
}

type Props = CardProps & { onPress: () => void; scale?: number; accessibilityLabel?: string; accessibilityHint?: string };

// The card at 0.45 scale as one button; nothing inside it takes focus.
export function KeepsakeThumb({ onPress, scale = THUMB_SCALE, accessibilityLabel = "Your keepsake card", accessibilityHint = "Shows the card at full size.", ...card }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
