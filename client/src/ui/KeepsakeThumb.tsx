import { Pressable, View } from "react-native";
import { KeepsakeCard } from "./KeepsakeCard";
import { card as cardTokens, focusRing } from "./theme";
import { useState, type ComponentProps } from "react";

const SCALE = 0.45;
const WIDTH = cardTokens.width * SCALE;
const HEIGHT = (cardTokens.width / cardTokens.aspectRatio) * SCALE;

type Props = Pick<ComponentProps<typeof KeepsakeCard>, "card" | "templateId" | "placeholder" | "entering"> & { onPress: () => void };

// The card at 0.45 scale as one button; nothing inside it takes focus.
export function KeepsakeThumb({ onPress, ...card }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your keepsake card"
      accessibilityHint="Shows the card at full size."
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[{ width: WIDTH, height: HEIGHT, overflow: "hidden" }, focused && focusRing]}
    >
      <View aria-hidden pointerEvents="none" style={{ width: cardTokens.width, transform: [{ scale: SCALE }], transformOrigin: "top left" }}>
        <KeepsakeCard {...card} accessibilityLabel="Keepsake preview" />
      </View>
    </Pressable>
  );
}
