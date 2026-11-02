import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors } from "./theme";

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  const body = <Text variant="body">{message}</Text>;
  return <View role={error ? "alert" : undefined} style={styles.box}>{body}</View>;
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.black, padding: 12 },
});
