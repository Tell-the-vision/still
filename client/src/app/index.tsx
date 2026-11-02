import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

// Home 01 (SPEC §1.1): wordmark with login and QR scan entry points.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>STILL</Text>
      <Link href="/login?returnTo=/" style={styles.button}>
        Login
      </Link>
      <Link href="/scan" style={styles.button}>
        QR Scan
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  wordmark: { fontSize: 40, letterSpacing: 8, marginBottom: 24 },
  button: { fontSize: 16, paddingVertical: 8, paddingHorizontal: 24 },
});
