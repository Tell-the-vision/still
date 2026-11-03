import { Link, type Href } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Mark } from "./Mark";
import { Text, type TextVariant } from "./Text";
import { focusRing, spacing } from "./theme";
import { focusVisible } from "./focusVisible";

type Props = {
  label: string;
  accessibilityLabel?: string;
  variant?: Extract<TextVariant, "action" | "secondary" | "subhead" | "label">;
  tone?: "primary" | "secondary";
  mark?: ComponentProps<typeof Mark>["shape"];
  leading?: string;
  trailing?: string;
  disabled?: boolean;
  active?: boolean;
  // A radio reports `active` as checked instead of pressed.
  role?: "radio";
  download?: boolean;
  target?: "_blank";
} & ({ href: Href; onPress?: () => void } | { onPress: () => void; href?: undefined });

// A borderless text action: a link with `href`, otherwise a button. `leading` and `trailing` are decorative glyphs.
export function TextAction({ label, accessibilityLabel, variant = "action", tone, mark, leading, trailing, href, onPress, disabled = false, active, role, download, target }: Props) {
  const [focused, setFocused] = useState(false);
  // Tracked as state because a style function would break `Link asChild`.
  const [pressed, setPressed] = useState(false);
  // A disabled action is always gray.
  const color = disabled ? "secondary" : tone;
  // Montserrat's arrow sits low at the larger sizes, so it is lifted to the label's x-height.
  const lift = variant === "subhead" ? -2 : -1;
  const glyph = (text: string) => (
    <Text variant={variant} tone={color} aria-hidden style={{ transform: [{ translateY: lift }] }}>
      {text}
    </Text>
  );
  const pressable = (
    <Pressable
      {...((download || target) && { hrefAttrs: { ...(download && { download: "" }), ...(target && { target, rel: "noopener noreferrer" }) } })}
      accessibilityRole={role ?? (href === undefined ? "button" : "link")}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === "radio" ? { disabled, checked: active } : { disabled, selected: active }}
      aria-pressed={role === "radio" ? undefined : active}
      aria-checked={role === "radio" ? active : undefined}
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(focusVisible())}
      onBlur={() => setFocused(false)}
      // Flattened because `Link asChild` forwards the style prop untouched.
      style={StyleSheet.flatten([focused && focusRing, pressed && styles.pressed])}
    >
      <View style={styles.row}>
        {mark ? <Mark shape={mark} /> : null}
        {leading ? glyph(leading) : null}
        <Text variant={variant} tone={color}>
          {label}
        </Text>
        {trailing ? glyph(trailing) : null}
      </View>
    </Pressable>
  );
  return href === undefined ? pressable : <Link href={href} asChild>{pressable}</Link>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.inset },
  pressed: { opacity: 0.6 },
});
