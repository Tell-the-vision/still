import { createContext, useRef, type ReactNode, type RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { TextLink } from "./TextLink";
import { Wordmark } from "./Wordmark";
import { uiStrings } from "./strings";
import { colors, rule, spacing } from "./theme";

type Props = { children: ReactNode; header?: boolean; headerRight?: boolean; tabs?: boolean; scroll?: boolean };

// Lets a child scroll its own position into view, e.g. after a login round trip (SPEC §2.2 Sign in 8).
export const ScreenScrollContext = createContext<RefObject<ScrollViewInstance | null> | null>(null);

// Widest column before iPad and desktop web stop stretching; identical at the 390×844 design base.
const COLUMN_MAX_WIDTH = 560;

// `header` (default on) shows the wordmark over a rule; `headerRight` adds the MY ARCHIVE link (SPEC §0.3);
// `tabs` shows the bottom tab bar.
// `scroll={false}` is for screens that bring their own list (a FlatList must not nest in a ScrollView).
export function Screen({ children, header = true, headerRight = false, tabs = false, scroll = true }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.column}>
        <KeyboardAvoidingView behavior={Platform.OS === "web" ? undefined : "padding"} style={styles.fill}>
          {header && (
            <View style={styles.header}>
              <Wordmark size="header" />
              {headerRight && <TextLink href="/archive" label={uiStrings.myArchive} variant="eyebrow" tone="secondary" />}
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
        {tabs && <BottomNav />}
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
    minHeight: spacing.headerHeight,
    marginHorizontal: spacing.gutter,
    borderBottomWidth: rule,
    borderColor: colors.black,
  },
  content: { flexGrow: 1, ...content },
  body: { flex: 1, ...content },
});
