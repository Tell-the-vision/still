import { createContext, useRef, type ReactNode, type RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { TextLink } from "./TextLink";
import { uiStrings } from "./strings";
import { colors, spacing } from "./theme";

type Props = { children: ReactNode; headerRight?: boolean; tabs?: boolean; scroll?: boolean };

// Lets a child scroll its own position into view, e.g. after a login round trip (SPEC §2.2 Sign in 8).
export const ScreenScrollContext = createContext<RefObject<ScrollViewInstance | null> | null>(null);

// Widest column before iPad and desktop web stop stretching; identical at the 390×844 design base.
const COLUMN_MAX_WIDTH = 560;

// `headerRight` shows the MY ARCHIVE link (SPEC §0.3); `tabs` shows the bottom tab bar.
// `scroll={false}` is for screens that bring their own list (a FlatList must not nest in a ScrollView).
export function Screen({ children, headerRight = false, tabs = false, scroll = true }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.column}>
        <KeyboardAvoidingView behavior={Platform.OS === "web" ? undefined : "padding"} style={styles.fill}>
          {headerRight && (
            <View style={styles.header}>
              <TextLink href="/archive" label={uiStrings.myArchive} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  column: { flex: 1, width: "100%", maxWidth: COLUMN_MAX_WIDTH, alignSelf: "center" },
  fill: { flex: 1 },
  header: { alignItems: "flex-end", paddingHorizontal: spacing.gutter, paddingTop: spacing.gap },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter },
  body: { flex: 1, paddingHorizontal: spacing.gutter },
});
