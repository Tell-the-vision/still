import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, type TextVariant } from "./Text";
import { focusRing } from "./theme";

type Props = {
  label: string;
  variant?: Extract<TextVariant, "action" | "secondary">;
  tone?: "primary" | "secondary";
  leading?: string;
  trailing?: string;
  disabled?: boolean;
  download?: boolean;
  target?: "_blank";
} & ({ href: Href; onPress?: () => void } | { onPress: () => void; href?: undefined });

// A borderless text action: a link with `href`, otherwise a button. `leading` and `trailing` are decorative glyphs.
export function TextAction({ label, variant = "action", tone, leading, trailing, href, onPress, disabled = false, download, target }: Props) {
  const [focused, setFocused] = useState(false);
  // Tracked as state because a style function would break `Link asChild`.
  const [pressed, setPressed] = useState(false);
  // A disabled action is always gray.
  const color = disabled ? "secondary" : tone;
  const glyph = (text: string) => (
    <Text variant={variant} tone={color} aria-hidden>
      {text}
    </Text>
  );
  const pressable = (
    <Pressable
      {...((download || target) && { hrefAttrs: { ...(download && { download: "" }), ...(target && { target, rel: "noopener noreferrer" }) } })}
      accessibilityRole={href === undefined ? "button" : "link"}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // Flattened because `Link asChild` forwards the style prop untouched.
      style={StyleSheet.flatten([focused && focusRing, pressed && styles.pressed])}
    >
      <View style={styles.row}>
        {leading ? glyph(`${leading} `) : null}
        <Text variant={variant} tone={color}>
          {label}
        </Text>
        {trailing ? glyph(` ${trailing}`) : null}
      </View>
    </Pressable>
  );
  return href === undefined ? pressable : <Link href={href} asChild>{pressable}</Link>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  pressed: { opacity: 0.6 },
});
