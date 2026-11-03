import { StyleSheet, View } from "react-native";
import { colors } from "./theme";

// A drawn QR symbol; decorative. A finder is 7 modules (1 border, 3 inner) and the box is 20 modules wide,
// so the module is a whole number of pixels whenever size is a multiple of 20 and 1px below that.
const FINDER = 7;
const GRID = 20;
// Data modules (2 wide) in the bottom-right quadrant, as [x, y] in modules.
const DATA = [[12, 12], [16, 12], [12, 16], [16, 16]] as const;

export function QrIcon({ size = 20 }: { size?: number }) {
  const m = Math.max(1, Math.floor(size / GRID));
  const finder = (left: number, top: number) => (
    <View style={[styles.finder, { left: left * m, top: top * m, width: FINDER * m, height: FINDER * m, borderWidth: m }]}>
      <View style={{ margin: m, flex: 1, backgroundColor: colors.black }} />
    </View>
  );
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      {finder(0, 0)}
      {finder(GRID - FINDER, 0)}
      {finder(0, GRID - FINDER)}
      {DATA.map(([x, y]) => (
        <View key={`${x}-${y}`} style={{ position: "absolute", left: x * m, top: y * m, width: 2 * m, height: 2 * m, backgroundColor: colors.black }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  finder: { position: "absolute", borderColor: colors.black },
});
