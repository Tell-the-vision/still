import { track } from "../../lib/analytics";
import { useFocusEffect } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Choice } from "../../ui/Choice";
import { Notice } from "../../ui/Notice";
import { audioStrings } from "./strings";

const FADE_IN_MS = 2000;
const TARGET_VOLUME = 0.6;
const START_TIMEOUT_MS = 2000;

// SPEC §6.1: Ambience plays only from this press and is Off on every mount, blur, unmount and background.
export function AmbienceToggle({ code, selected, onSelect, onStop }: { code: string; selected: boolean; onSelect: () => void; onStop: () => void }) {
  const player = useAudioPlayer(require("../../../assets/audio/ambience.mp3"));
  const status = useAudioPlayerStatus(player);
  // True from the press until the player reports it is playing, or the start times out.
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirmed = useRef(false);
  // Latest parent callbacks; the parent passes new functions on every render (e.g. while typing),
  // and effects keyed on them would stop the sound each time.
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
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
    setStarting(false);
  }, [player]);

  // The parent owns the selection: anything other than Ambience being selected means silence.
  useEffect(() => {
    if (selected) return;
    if (confirmed.current) track("ambience_off", { exhibition_code: code });
    confirmed.current = false;
    stop();
  }, [selected, stop, code]);
  // Playback that really started is what turns Ambience on.
  useEffect(() => {
    if (!starting || !status.playing) return;
    setStarting(false);
    confirmed.current = true;
    fadeIn();
    onSelect();
    track("ambience_on", { exhibition_code: code });
  }, [starting, status.playing, fadeIn, onSelect, code]);
  // Playback that does not start in time is a failure.
  useEffect(() => {
    if (!starting) return;
    const timer = setTimeout(() => {
      setFailed(true);
      stop();
    }, START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [starting, stop]);
  useEffect(() => {
    player.loop = true;
  }, [player]);
  // Some web players ignore loop; restart from the top when the file ends while Ambience is on.
  useEffect(() => {
    if (!status.didJustFinish || !confirmed.current) return;
    player.seekTo(0);
    player.play();
  }, [status.didJustFinish, player]);
  // Leaving the screen (blur/unmount) and backgrounding are the only lifecycle stops.
  useFocusEffect(useCallback(() => () => { stop(); onStopRef.current(); }, [stop]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      stop();
      onStopRef.current();
    });
    return () => subscription.remove();
  }, [stop]);

  // Pressing the selected option does nothing.
  const press = async () => {
    if (selected || starting) return;
    setFailed(false);
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
    player.volume = 0;
    player.loop = true;
    player.play();
    setStarting(true);
  };

  return (
    <>
      <Choice role="radio" label={audioStrings.ambience} selected={selected} onPress={press} />
      {failed && <Notice error message={audioStrings.playFailed} />}
    </>
  );
}
