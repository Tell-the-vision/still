import type { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { colors, spacing } from "./theme";

// Modal dialog. On web, RN's Modal traps focus and calls onClose on Escape.
export function Dialog({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View role="dialog" aria-modal style={styles.panel}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.gap, backgroundColor: "rgba(0,0,0,0.4)" },
  panel: { gap: spacing.gap, padding: spacing.gap, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.black },
});
