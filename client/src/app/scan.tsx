import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused, useRouter } from "expo-router";
import { View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { parseExhibitionTarget } from "@still/shared/entry";
import { useUserState } from "../features/auth/use-me";
import { track } from "../lib/analytics";
import { entryStrings } from "../features/entry/strings";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";
import { Viewfinder } from "../ui/Viewfinder";

const stillOrigin =
  process.env.EXPO_OS === "web" ? window.location.origin : (process.env.EXPO_PUBLIC_STILL_ORIGIN ?? "");

// QR Scan 03 (SPEC §1.2): enter an exhibition URL or code by hand.
export default function Scan() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [entering, setEntering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const handlingScan = useRef(false);
  const userState = useUserState();

  useEffect(() => {
    if (userState) track("qr_scan_start", { user_state: userState });
  }, [userState]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  function openTarget(input: string) {
    const target = parseExhibitionTarget(input, stillOrigin);
    setNotice(target ? null : entryStrings.notStill);
    if (target) router.push(target.page ? `/e/${target.code}/${target.page}` : `/e/${target.code}`);
  }

  function onScanned(data: string) {
    if (handlingScan.current) return;
    handlingScan.current = true;
    openTarget(data);
    setTimeout(() => (handlingScan.current = false), 1500);
  }

  const cameraOn = permission?.granted === true && focused;
  const showField = entering || (permission !== null && !permission.granted);

  return (
    <Screen tabs>
      <Stack gap="section">
        <Stack gap="tight">
          <Text variant="headline">{entryStrings.headline}</Text>
          <Text variant="secondary">{entryStrings.headlineHint}</Text>
        </Stack>
        <View style={{ width: "100%", maxWidth: 320, alignSelf: "center" }}>
        <Viewfinder label={entryStrings.viewfinder}>
          {cameraOn && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
              onMountError={() => setNotice(entryStrings.readFailed)}
            />
          )}
        </Viewfinder>
        </View>
        {notice && <Notice message={notice} error />}
        {permission && !permission.granted && <Notice message={entryStrings.cameraOff} />}
        <Stack gap="tight">
          <Text variant="label">{entryStrings.trouble}</Text>
          <Text variant="secondary">{entryStrings.troubleHint}</Text>
        </Stack>
        {showField ? (
          <Stack gap="gap">
            <TextField
              label={entryStrings.inputLabel}
              value={value}
              onChangeText={setValue}
              onSubmit={() => openTarget(value)}
              autoFocus={entering}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button label={entryStrings.open} onPress={() => openTarget(value)} />
          </Stack>
        ) : (
          <Button label={entryStrings.enterUrl} onPress={() => setEntering(true)} />
        )}
      </Stack>
    </Screen>
  );
}
