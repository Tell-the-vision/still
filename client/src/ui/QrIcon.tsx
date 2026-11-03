import { View } from "react-native";
import { colors } from "./theme";

// A scan symbol: four thin corner brackets forming a square viewfinder; decorative.
const STROKE = 1.5;
const ARM = 0.3;

export function QrIcon({ size = 20 }: { size?: number }) {
  const arm = Math.round(size * ARM);
  const corner = (top: boolean, left: boolean) => (
    <View
      style={{
        position: "absolute",
        width: arm,
        height: arm,
        [top ? "top" : "bottom"]: 0,
        [left ? "left" : "right"]: 0,
        borderColor: colors.black,
        [top ? "borderTopWidth" : "borderBottomWidth"]: STROKE,
        [left ? "borderLeftWidth" : "borderRightWidth"]: STROKE,
      }}
    />
  );
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      {corner(true, true)}
      {corner(true, false)}
      {corner(false, true)}
      {corner(false, false)}
    </View>
  );
}
