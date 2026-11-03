import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors } from "./theme";
import { focusVisible } from "./focusVisible";

type Props = { href: Href; label: string; style?: StyleProp<ViewStyle>; selected?: boolean; variant?: "label" | "secondary" | "eyebrow" | "action" | "caption"; tone?: "primary" | "secondary"; target?: "_blank"; onPress?: () => void };

// A text-only navigation link. Shows the same web focus ring as `Button`.
export function TextLink({ href, label, style, selected = false, variant = "label", tone, target, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        // react-native-web renders anchor attributes from `hrefAttrs`; `Link asChild` would pass bare `target`.
        {...(target && { hrefAttrs: { target, rel: "noopener noreferrer" } })}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        aria-current={selected ? "page" : undefined}
        onPress={onPress}
        hitSlop={12}
        onFocus={() => setFocused(focusVisible())}
        onBlur={() => setFocused(false)}
        // Flattened because `Link asChild` forwards the style prop untouched.
        style={StyleSheet.flatten([style, focused && styles.focus])}
      >
        <Text variant={variant} tone={tone} maxFontSizeMultiplier={1.5} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  focus: { outlineWidth: 2, outlineOffset: 2, outlineColor: colors.black, outlineStyle: "solid" },
});
