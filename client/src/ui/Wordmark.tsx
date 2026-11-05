import { Text } from "./Text";
import { fontFamily, wordmark } from "./theme";

// `color` sets the mark in white on black (the keepsake card's band); black otherwise.
export function Wordmark({ size = "hero", color }: { size?: keyof typeof wordmark; color?: string }) {
  const { size: fontSize, line, tracking, text } = wordmark[size];
  return <Text style={{ fontFamily: fontFamily.display, fontSize, lineHeight: line, letterSpacing: tracking, ...(color && { color }) }}>{text}</Text>;
}
