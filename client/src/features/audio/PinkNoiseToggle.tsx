import { track } from "../../lib/analytics";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { Choice } from "../../ui/Choice";
import { Notice } from "../../ui/Notice";
import { audioStrings } from "./strings";

// SPEC §6.1: Pink Noise plays only from this press and is Off on every mount, blur, unmount and background.
export function PinkNoiseToggle({ code, forceOff, onPlay }: { code: string; forceOff: boolean; onPlay: () => void }) {
  const player = useAudioPlayer(require("../../../assets/audio/pink-noise.wav"));
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    player.pause();
    setOn(false);
  }, [player]);

  useEffect(() => {
    if (forceOff) stop();
  }, [forceOff, stop]);
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
      onPlay();
      track("ambience_on", { exhibition_code: code });
    } catch {
      setFailed(true);
      stop();
    }
  };

  return (
    <>
      <Choice role="radio" label={audioStrings.pinkNoise} selected={on} onPress={toggle} />
      {failed && <Notice error message={audioStrings.playFailed} />}
    </>
  );
}
