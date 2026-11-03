import { View } from "react-native";
import { QrIcon } from "./QrIcon";
import { colors, mark } from "./theme";

// A filled black shape that leads a text action; decorative.
export function Mark({ shape }: { shape: keyof typeof mark }) {
  const size = mark[shape];
  if (shape === "qr") return <QrIcon size={size} />;
  return <View aria-hidden style={{ width: size, height: size, backgroundColor: colors.black, borderRadius: shape === "circle" ? size / 2 : 0 }} />;
}
