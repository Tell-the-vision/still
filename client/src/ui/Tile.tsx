import { Link, type Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, focusRing, rule, spacing } from "./theme";
import { focusVisible } from "./focusVisible";

// A link cell for grids: a 1px black outline around its content, or bare when the content draws its own frame.
export function Tile({ href, label, framed = true, children }: { href: Href; label: string; framed?: boolean; children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onFocus={() => setFocused(focusVisible())}
        onBlur={() => setFocused(false)}
        // Flattened because `Link asChild` forwards the style prop untouched.
        style={StyleSheet.flatten([styles.tile, framed && styles.framed, focused && focusRing])}
      >
        {children}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: spacing.tight },
  framed: { padding: spacing.tight, borderWidth: rule, borderColor: colors.black },
});
