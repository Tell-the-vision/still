import { Link, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors } from "./theme";

const tabs: { label: string; href: Href }[] = [
  { label: "HOME", href: "/" },
  { label: "ARCHIVE", href: "/archive" },
  { label: "ACCOUNT", href: "/account" },
];

export function BottomNav() {
  return (
    <View role="navigation" aria-label="Main" style={styles.bar}>
      {tabs.map((tab) => (
        <Link key={tab.label} href={tab.href} style={styles.tab}>
          <Text variant="label">{tab.label}</Text>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.black },
  tab: { flex: 1, paddingVertical: 16, textAlign: "center" },
});
