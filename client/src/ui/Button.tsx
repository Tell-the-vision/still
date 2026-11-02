import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, focusRing } from "./theme";

type Props = { label: string; variant?: "primary" | "secondary"; disabled?: boolean } & (
  | { href: Href; onPress?: undefined }
  | { onPress: () => void; href?: undefined }
);

// Renders a link when given `href`, otherwise a button. Both show a focus ring on web.
export function Button({ label, variant = "primary", href, onPress, disabled = false }: Props) {
  const primary = variant === "primary";
  const [focused, setFocused] = useState(false);
  const pressable = (
    <Pressable
      accessibilityRole={href === undefined ? "button" : "link"}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // Flattened because `Link asChild` forwards the style prop untouched.
      style={StyleSheet.flatten([styles.base, primary ? styles.primary : styles.secondary, focused && styles.focus, disabled && styles.disabled])}
    >
      <Text variant="label" style={{ color: primary ? colors.white : colors.black }}>
        {label}
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
  focus: focusRing,
});
