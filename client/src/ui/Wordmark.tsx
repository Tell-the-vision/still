import { Text } from "./Text";
import { fontFamily, wordmark } from "./theme";

export function Wordmark({ size = "hero" }: { size?: keyof typeof wordmark }) {
  const { size: fontSize, line, tracking, text } = wordmark[size];
  return <Text style={{ fontFamily: fontFamily.display, fontSize, lineHeight: line, letterSpacing: tracking }}>{text}</Text>;
}
