import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { parseExhibitionTarget } from "@still/shared/entry";
import { entryStrings } from "../features/entry/strings";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { colors, spacing } from "../ui/theme";

const stillOrigin =
  process.env.EXPO_OS === "web" ? window.location.origin : (process.env.EXPO_PUBLIC_STILL_ORIGIN ?? "");

// QR Scan 03 (SPEC §1.2): enter an exhibition URL or code by hand.
export default function Scan() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function open() {
    const target = parseExhibitionTarget(value, stillOrigin);
    setInvalid(target === null);
    if (target) router.push(`/e/${target.code}`);
  }

  return (
    <Screen tabs>
      <View style={styles.body}>
        <Text variant="label">{entryStrings.title}</Text>
        <TextInput
          accessibilityLabel={entryStrings.inputLabel}
          placeholder={entryStrings.inputLabel}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Button label={entryStrings.open} onPress={open} />
        {invalid && <Notice message={entryStrings.notStill} error />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center", gap: spacing.gap },
  input: { borderWidth: 1, borderColor: colors.black, padding: 12 },
});
