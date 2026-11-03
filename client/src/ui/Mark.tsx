import { View } from "react-native";
import { colors, mark } from "./theme";

// A filled black shape that leads a text action; decorative.
export function Mark({ shape }: { shape: keyof typeof mark }) {
  const size = mark[shape];
  return <View aria-hidden style={{ width: size, height: size, backgroundColor: colors.black, borderRadius: shape === "circle" ? size / 2 : 0 }} />;
}
