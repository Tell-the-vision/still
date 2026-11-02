import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors } from "./theme";

type Props = { href: Href; label: string; style?: StyleProp<ViewStyle>; selected?: boolean };

// A text-only navigation link. Shows the same web focus ring as `Button`.
export function TextLink({ href, label, style, selected = false }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        aria-current={selected ? "page" : undefined}
        hitSlop={12}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Flattened because `Link asChild` forwards the style prop untouched.
        style={StyleSheet.flatten([style, focused && styles.focus])}
      >
        <Text variant="label" maxFontSizeMultiplier={1.5} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  focus: { outlineWidth: 2, outlineOffset: 2, outlineColor: colors.black, outlineStyle: "solid" },
});
