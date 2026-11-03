import { track } from "../../lib/analytics";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Choice } from "../../ui/Choice";
import { Notice } from "../../ui/Notice";
import { audioStrings } from "./strings";

const FADE_IN_MS = 2000;
const TARGET_VOLUME = 0.6;

// SPEC §6.1: Ambience plays only from this press and is Off on every mount, blur, unmount and background.
export function AmbienceToggle({ code, forceOff, onPlay }: { code: string; forceOff: boolean; onPlay: () => void }) {
  const player = useAudioPlayer(require("../../../assets/audio/ambience.mp3"));
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  const ramp = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRamp = () => {
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = null;
  };

  // Fade in from silence so the loop never starts abruptly.
  const fadeIn = useCallback(() => {
    clearRamp();
    player.volume = 0;
    const startedAt = Date.now();
    ramp.current = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / FADE_IN_MS, 1);
      player.volume = progress * TARGET_VOLUME;
      if (progress === 1) clearRamp();
    }, 50);
  }, [player]);

  const stop = useCallback(() => {
    clearRamp();
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
      player.volume = 0;
      await player.play();
      fadeIn();
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
      <Choice role="radio" label={audioStrings.ambience} selected={on} onPress={toggle} />
      {failed && <Notice error message={audioStrings.playFailed} />}
    </>
  );
}
