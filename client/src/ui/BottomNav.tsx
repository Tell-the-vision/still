import { usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { TextLink } from "./TextLink";
import { uiStrings } from "./strings";
import { colors, rule, spacing } from "./theme";

const tabs: { label: string; href: "/" | "/archive" | "/account"; align: "flex-start" | "center" | "flex-end" }[] = [
  { label: uiStrings.tabs.home, href: "/", align: "flex-start" },
  { label: uiStrings.tabs.archive, href: "/archive", align: "center" },
  { label: uiStrings.tabs.account, href: "/account", align: "flex-end" },
];

// `placement="header"` is the desktop web variant: the same tabs, inline in the top header instead of a bottom bar.
export function BottomNav({ placement = "bottom" }: { placement?: "bottom" | "header" }) {
  const pathname = usePathname();
  return (
    <View role="navigation" aria-label="Main" style={placement === "header" ? styles.headerBar : styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <TextLink
            key={tab.label}
            href={tab.href}
            label={tab.label}
            variant="eyebrow"
            tone={selected ? "primary" : "secondary"}
            style={placement === "header" ? styles.headerTab : [styles.tab, { alignItems: tab.align }]}
            selected={selected}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", marginHorizontal: spacing.gutter, borderTopWidth: rule, borderColor: colors.black },
  headerBar: { flexDirection: "row", gap: spacing.section },
  headerTab: {},
  tab: { flex: 1, paddingTop: spacing.headerTop, paddingBottom: spacing.gap },
});
