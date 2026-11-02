import { Link } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { Text } from "./Text";
import { colors, spacing } from "./theme";

type Props = { children: ReactNode; headerRight?: boolean; tabs?: boolean };

// `headerRight` shows the MY ARCHIVE link (SPEC §0.3); `tabs` shows the bottom tab bar.
export function Screen({ children, headerRight = false, tabs = false }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      {headerRight && (
        <View style={styles.header}>
          <Link href="/archive">
            <Text variant="label">MY ARCHIVE</Text>
          </Link>
        </View>
      )}
      <View style={styles.body}>{children}</View>
      {tabs && <BottomNav />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { alignItems: "flex-end", paddingHorizontal: spacing.gutter, paddingTop: spacing.gap },
  body: { flex: 1, paddingHorizontal: spacing.gutter },
});
