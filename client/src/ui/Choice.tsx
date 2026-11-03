import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text, type TextVariant } from "./Text";
import { colors, control, focusRing, spacing } from "./theme";
import { focusVisible } from "./focusVisible";

type Props = {
  label: string;
  selected: boolean;
  role: "radio" | "switch" | "checkbox" | "button";
  layout?: "row" | "tile";
  disabled?: boolean;
  textVariant?: TextVariant;
  target?: "_blank";
} & ({ href: Href; onPress?: () => void } | { onPress: () => void; href?: undefined });

// A bordered choice: black fill with white text when selected. A link with `href`, otherwise a button of the given role.
export function Choice({ label, selected, role, layout = "row", disabled = false, textVariant = "secondary", target, href, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  const pressable = (
    <Pressable
      {...(target && { hrefAttrs: { target, rel: "noopener noreferrer" } })}
      accessibilityRole={href === undefined ? role : "link"}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={role === "button" ? undefined : selected}
      aria-pressed={role === "button" ? selected : undefined}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(focusVisible())}
      onBlur={() => setFocused(false)}
      // Flattened because `Link asChild` forwards the style prop untouched.
      style={StyleSheet.flatten([styles.base, layout === "row" ? styles.row : styles.tile, selected && styles.selected, focused && focusRing])}
    >
      <Text variant={textVariant} style={{ textAlign: layout === "tile" ? "center" : undefined, color: selected ? colors.white : disabled ? colors.gray : colors.black }}>{label}</Text>
    </Pressable>
  );
  return href === undefined ? pressable : <Link href={href} asChild>{pressable}</Link>;
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, borderColor: colors.black, backgroundColor: colors.white, justifyContent: "center" },
  row: { alignSelf: "stretch", minHeight: control.row, paddingHorizontal: spacing.inset + 2, paddingVertical: spacing.inset },
  tile: { flex: 1, flexBasis: 0, minHeight: control.tile, alignItems: "center", paddingHorizontal: spacing.tight },
  selected: { backgroundColor: colors.black },
});
