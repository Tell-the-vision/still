import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View, type HostInstance } from "react-native";
import { colors, focusRing } from "../../ui/theme";
import { scrapStrings } from "./strings";

type Props = { kept: boolean; pending?: boolean; hint?: string; onPress: () => void };

// The keep mark (SPEC §4.1): "+" keeps a line, a check shows it is kept and removes it again.
export function KeepMark({ kept, pending = false, hint, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  // react-native-web drops `title`, so the tooltip is set on the DOM node.
  const markRef = useRef<HostInstance>(null);
  const tooltip = kept ? scrapStrings.keptTitle : scrapStrings.keep;
  useEffect(() => {
    if (Platform.OS === "web") (markRef.current as unknown as HTMLElement | null)?.setAttribute("title", tooltip);
  }, [tooltip]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kept ? scrapStrings.remove : scrapStrings.keep}
      ref={markRef}
      accessibilityHint={hint}
      accessibilityState={{ selected: kept, disabled: pending }}
      disabled={pending}
      onPress={onPress}
      hitSlop={{ top: 13, bottom: 12, left: 10, right: 10 }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.mark, pending && styles.pending, focused && focusRing]}
    >
      {kept ? <Check /> : <Plus />}
    </Pressable>
  );
}

// Two 1px bars in a 12x12 box; black only (SPEC §0.3).
function Plus() {
  return (
    <View aria-hidden style={styles.box}>
      <View style={[styles.bar, { width: MARK, height: 1 }]} />
      <View style={[styles.bar, { width: 1, height: MARK }]} />
    </View>
  );
}

// A checkmark from two 1px bars: a short stroke down to the right, a long one up to the right.
function Check() {
  return (
    <View aria-hidden style={styles.box}>
      <View style={[styles.bar, { width: 1, height: 5, left: 2, top: 5.5, transform: [{ rotate: "-45deg" }] }]} />
      <View style={[styles.bar, { width: 1, height: 10, left: 7.5, top: 1, transform: [{ rotate: "40deg" }] }]} />
    </View>
  );
}

const MARK = 12;
const styles = StyleSheet.create({
  // 24 wide and one quote line (18.6) tall, so the mark sits on the first line.
  mark: { width: 24, height: 19, alignItems: "center", justifyContent: "center" },
  pending: { opacity: 0.4 },
  box: { width: MARK, height: MARK, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", backgroundColor: colors.black },
});
