import { track } from "../../lib/analytics";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable } from "react-native";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { focusRing } from "../../ui/theme";
import { audioStrings } from "./strings";

// SPEC §6.1: Pink Noise plays only from this press and is Off on every mount, blur, unmount and background.
export function PinkNoiseToggle({ code }: { code: string }) {
  const player = useAudioPlayer(require("../../../assets/audio/pink-noise.wav"));
  const [on, setOn] = useState(false);
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    player.pause();
    setOn(false);
  }, [player]);

  useEffect(() => {
    player.loop = true;
  }, [player]);
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => state !== "active" && stop());
    return () => subscription.remove();
  }, [stop]);

  const toggle = async () => {
    if (on) {
      track("ambience_off", { exhibition_code: code });
      return stop();
    }
    try {
      setFailed(false);
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      await player.play();
      setOn(true);
      track("ambience_on", { exhibition_code: code });
    } catch {
      setFailed(true);
      stop();
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={audioStrings.pinkNoise}
        accessibilityState={{ checked: on }}
        aria-checked={on}
        onPress={toggle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={focused && focusRing}
      >
        <Text variant="label">{`${audioStrings.pinkNoise} · ${on ? audioStrings.on : audioStrings.off}`}</Text>
      </Pressable>
      {failed && <Notice error message={audioStrings.playFailed} />}
    </>
  );
}
