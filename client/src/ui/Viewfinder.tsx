import type { ReactNode } from "react";
import { View } from "react-native";
import { colors, rule, viewfinder } from "./theme";

const { bracketLength, bracketThickness, bracketInset } = viewfinder;
const bar = { position: "absolute", backgroundColor: colors.black } as const;

// One corner bracket: two bars meeting at the corner of a square inset from the frame.
function Bracket({ top, left }: { top: boolean; left: boolean }) {
  const side = { [top ? "top" : "bottom"]: 0, [left ? "left" : "right"]: 0 };
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", width: bracketLength, height: bracketLength, [top ? "top" : "bottom"]: bracketInset, [left ? "left" : "right"]: bracketInset }}
    >
      <View style={[bar, side, { width: bracketLength, height: bracketThickness }]} />
      <View style={[bar, side, { width: bracketThickness, height: bracketLength }]} />
    </View>
  );
}

// A square 1px frame with four corner brackets, wrapping the camera.
export function Viewfinder({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <View accessibilityLabel={label} style={{ aspectRatio: 1, width: "100%", borderWidth: rule, borderColor: colors.black }}>
      {children}
      <Bracket top left />
      <Bracket top left={false} />
      <Bracket top={false} left />
      <Bracket top={false} left={false} />
    </View>
  );
}
