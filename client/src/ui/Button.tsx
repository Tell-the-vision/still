import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, focusRing } from "./theme";

type Props = { label: string; variant?: "primary" | "secondary"; disabled?: boolean; trailing?: string; selected?: boolean; download?: boolean } & (
  | { href: Href; onPress?: () => void }
  | { onPress: () => void; href?: undefined }
);

// Renders a link when given `href`, otherwise a button. Both show a focus ring on web.
// `download` (web) saves the linked file. `trailing` is a decorative suffix (e.g. an arrow) hidden from screen readers.
export function Button({ label, variant = "primary", href, onPress, disabled = false, trailing, selected, download }: Props) {
  const primary = variant === "primary";
  const [focused, setFocused] = useState(false);
  // Tracked as state because a style function would break `Link asChild`.
  const [pressed, setPressed] = useState(false);
  const pressable = (
    <Pressable
      {...(download && { hrefAttrs: { download: "" } })}
      accessibilityRole={href === undefined ? "button" : "link"}
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      aria-pressed={selected}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // Flattened because `Link asChild` forwards the style prop untouched.
      style={StyleSheet.flatten([styles.base, primary ? styles.primary : styles.secondary, focused && styles.focus, pressed && styles.pressed, disabled && styles.disabled])}
    >
      <Text variant="label" style={{ color: primary ? colors.white : colors.black }}>
        {label}
        {trailing ? <Text variant="label" aria-hidden style={{ color: primary ? colors.white : colors.black }}>{` ${trailing}`}</Text> : null}
      </Text>
    </Pressable>
  );
  return href === undefined ? pressable : <Link href={href} asChild>{pressable}</Link>;
}

const styles = StyleSheet.create({
  base: { minWidth: 240, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.black },
  primary: { backgroundColor: colors.black },
  secondary: { backgroundColor: colors.white },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  focus: focusRing,
});
