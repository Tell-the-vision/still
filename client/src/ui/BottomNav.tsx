import { usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { TextLink } from "./TextLink";
import { uiStrings } from "./strings";
import { colors, spacing } from "./theme";

const tabs: { label: string; href: "/" | "/archive" | "/account" }[] = [
  { label: uiStrings.tabs.home, href: "/" },
  { label: uiStrings.tabs.archive, href: "/archive" },
  { label: uiStrings.tabs.account, href: "/account" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <View role="navigation" aria-label="Main" style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return <TextLink key={tab.label} href={tab.href} label={tab.label} style={styles.tab} selected={selected} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.black },
  tab: { flex: 1, paddingVertical: spacing.gap, alignItems: "center" },
});
