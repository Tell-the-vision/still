import { createContext, useRef, type ReactNode, type RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { useWide } from "./useWide";
import { Link } from "expo-router";
import { Pressable } from "react-native";
import { Wordmark } from "./Wordmark";
import { colors, rule, spacing } from "./theme";

type Props = { children: ReactNode; header?: boolean; tabs?: boolean; scroll?: boolean; width?: "reading" | "wide" };

// Lets a child scroll its own position into view, e.g. after a login round trip (SPEC §2.2 Sign in 8).
export const ScreenScrollContext = createContext<RefObject<ScrollViewInstance | null> | null>(null);

// Widest column before iPad and desktop web stop stretching; identical at the 390×844 design base.
const COLUMN_MAX_WIDTH = 560;
// Desktop web (useWide): reading screens keep a comfortable measure, list and grid screens go wide.
const WIDE_MAX_WIDTH = { reading: 720, wide: 1144 } as const;

// `header` (default on) shows the wordmark over a rule; the wordmark links Home. On desktop web `tabs` render in the header;
// `tabs` shows the bottom tab bar.
// `scroll={false}` is for screens that bring their own list (a FlatList must not nest in a ScrollView).
export function Screen({ children, header = true, tabs = false, scroll = true, width = "reading" }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const wide = useWide();
  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.column, wide && { maxWidth: WIDE_MAX_WIDTH[width] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === "web" ? undefined : "padding"} style={styles.fill}>
          {header && (
            <View style={styles.header}>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="STILL, home" hitSlop={8}>
                  <Wordmark size="header" />
                </Pressable>
              </Link>
              {tabs && wide && <BottomNav placement="header" />}
            </View>
          )}
          {scroll ? (
            <ScrollView ref={scrollRef} style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <ScreenScrollContext.Provider value={scrollRef}>{children}</ScreenScrollContext.Provider>
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}
        </KeyboardAvoidingView>
        {tabs && !wide && <BottomNav />}
      </View>
    </SafeAreaView>
  );
}

const content = { paddingHorizontal: spacing.gutter, paddingTop: spacing.contentTop, paddingBottom: spacing.section, gap: spacing.gap };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  column: { flex: 1, width: "100%", maxWidth: COLUMN_MAX_WIDTH, alignSelf: "center" },
  fill: { flex: 1 },
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
