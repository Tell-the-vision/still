import { createContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { QrIcon } from "./QrIcon";
import { uiStrings } from "./strings";
import { useCanScan } from "./useCanScan";
import { useWide } from "./useWide";
import { Link, usePathname } from "expo-router";
import { Pressable } from "react-native";
import { Wordmark } from "./Wordmark";
import { colors, focusRing, rule, spacing } from "./theme";

type Props = { children: ReactNode; header?: boolean; tabs?: boolean; scroll?: boolean; width?: "reading" | "wide"; headerEnd?: ReactNode };

// Lets a child scroll its own position into view, e.g. after a login round trip (SPEC §2.2 Sign in 8).
export const ScreenScrollContext = createContext<RefObject<ScrollViewInstance | null> | null>(null);

// Widest column before iPad and desktop web stop stretching; identical at the 390×844 design base.
const COLUMN_MAX_WIDTH = 560;
// Desktop web (useWide): reading screens keep a comfortable measure, list and grid screens go wide.
const WIDE_MAX_WIDTH = { reading: 720, wide: 1144 } as const;

// `header` (default on) shows the wordmark over a rule; the wordmark links Home. On desktop web `tabs` render in the header;
// `tabs` shows the bottom tab bar.
// `scroll={false}` is for screens that bring their own list (a FlatList must not nest in a ScrollView).
export function Screen({ children, header = true, tabs = false, scroll = true, width = "reading", headerEnd }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const wide = useWide();
  const canScan = useCanScan() && usePathname() !== "/scan";
  // The scroll container spans the window so the wheel scrolls over the margins; the header and body share this centred column.
  const column = { width: "100%", maxWidth: wide ? WIDE_MAX_WIDTH[width] : COLUMN_MAX_WIDTH, alignSelf: "center" } as const;
  return (
    <SafeAreaView style={styles.root}>
      <>
        <KeyboardAvoidingView behavior={Platform.OS === "web" ? undefined : "padding"} style={styles.fill}>
          {header && (
            <View style={column}>
            <View style={styles.header}>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="STILL, home" hitSlop={8}>
                  <Wordmark size="header" />
                </Pressable>
              </Link>
              <View style={styles.headerRight}>
                {tabs && wide && <BottomNav placement="header" />}
                {headerEnd}
                {canScan && <QrScanLink />}
              </View>
            </View>
            </View>
          )}
          {scroll ? (
            <ScrollView ref={scrollRef} style={styles.fill} contentContainerStyle={[styles.content, column]} keyboardShouldPersistTaps="handled">
              <ScreenScrollContext.Provider value={scrollRef}>{children}</ScreenScrollContext.Provider>
            </ScrollView>
          ) : (
            <View style={[styles.body, column]}>{children}</View>
          )}
        </KeyboardAvoidingView>
        {tabs && !wide && <View style={column}><BottomNav /></View>}
      </>
    </SafeAreaView>
  );
}

// The header entry to /scan: icon only, with a 44×44 hit area.
function QrScanLink() {
  const [focused, setFocused] = useState(false);
  return (
    <Link href="/scan" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={uiStrings.qrScan}
        {...(Platform.OS === "web" && { title: uiStrings.qrScan })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={StyleSheet.flatten([styles.qrLink, focused && focusRing])}
      >
        <QrIcon size={20} />
      </Pressable>
    </Link>
  );
}

const content = { paddingHorizontal: spacing.gutter, paddingTop: spacing.contentTop, paddingBottom: spacing.section, gap: spacing.gap };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  fill: { flex: 1 },
  qrLink: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginVertical: -12, marginRight: -12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.section },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.headerTop,
    paddingBottom: spacing.gap,
    minHeight: spacing.headerHeight,
    marginHorizontal: spacing.gutter,
    borderBottomWidth: rule,
    borderColor: colors.black,
  },
  content: { flexGrow: 1, ...content },
  body: { flex: 1, ...content },
});
