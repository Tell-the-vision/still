import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { parseExhibitionTarget } from "@still/shared/entry";
import { entryStrings } from "../features/entry/strings";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";
import { spacing } from "../ui/theme";

const stillOrigin =
  process.env.EXPO_OS === "web" ? window.location.origin : (process.env.EXPO_PUBLIC_STILL_ORIGIN ?? "");

// QR Scan 03 (SPEC §1.2): enter an exhibition URL or code by hand.
export default function Scan() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const handlingScan = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  function openTarget(input: string) {
    const target = parseExhibitionTarget(input, stillOrigin);
    setNotice(target ? null : entryStrings.notStill);
    if (target) router.push(`/e/${target.code}`);
  }

  function onScanned(data: string) {
    if (handlingScan.current) return;
    handlingScan.current = true;
    openTarget(data);
    setTimeout(() => (handlingScan.current = false), 1500);
  }

  const cameraOn = permission?.granted === true && focused;

  return (
    <Screen tabs>
      <View style={styles.body}>
        {cameraOn && (
          <CameraView
            style={styles.camera}
            accessibilityLabel={entryStrings.viewfinder}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => onScanned(data)}
            onMountError={() => setNotice(entryStrings.readFailed)}
          />
        )}
        {permission && !permission.granted && <Notice message={entryStrings.cameraOff} />}
        <Text variant="label" role="heading">{entryStrings.title}</Text>
        <TextField
          label={entryStrings.inputLabel}
          value={value}
          onChangeText={setValue}
          onSubmit={() => openTarget(value)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button label={entryStrings.open} onPress={() => openTarget(value)} />
        {notice && <Notice message={notice} error />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center", gap: spacing.gap },
  camera: { aspectRatio: 1, width: "100%" },
});
