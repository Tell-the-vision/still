import { Link, type Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, focusRing, rule, spacing } from "./theme";

// A bordered link cell for grids: 1px black outline around its content.
export function Tile({ href, label, children }: { href: Href; label: string; children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Flattened because `Link asChild` forwards the style prop untouched.
        style={StyleSheet.flatten([styles.tile, focused && focusRing])}
      >
        {children}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: spacing.tight, padding: spacing.tight, borderWidth: rule, borderColor: colors.black },
});
