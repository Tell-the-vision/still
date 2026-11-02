"use client";

/**
 * App-wide audio state (spec §6).
 *
 * TBD-05 / TBD-06 (decided for MVP): STILL Ambience is offered on the
 * Exhibition Guide, the Journal and the Account screen, and keeps playing
 * across screen changes until the user turns it off. Default is OFF and it
 * never auto-plays (CORE-07).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { track } from "@/lib/client/analytics";
import { isPinkNoiseSupported, PinkNoiseEngine, type PinkNoiseState } from "./pink-noise";

export type AudioMode = "EXTERNAL_PLAYLIST" | "AMBIENCE" | "NONE";

type AudioContextValue = {
  ambience: PinkNoiseState;
  ambienceSupported: boolean;
  ambienceError: string | null;
  /** The option the user picked for the current session (UI state only). */
  mode: AudioMode;
  setMode: (mode: AudioMode) => void;
  ambienceOn: (exhibitionId?: string) => Promise<void>;
  ambienceOff: (exhibitionId?: string) => void;
  toggleAmbience: (exhibitionId?: string) => Promise<void>;
};

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const engine = useRef<PinkNoiseEngine | null>(null);
  const [ambience, setAmbience] = useState<PinkNoiseState>("off");
  const [ambienceError, setAmbienceError] = useState<string | null>(null);
  const [mode, setMode] = useState<AudioMode>("NONE");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isPinkNoiseSupported());
    return () => engine.current?.dispose();
  }, []);

  const ambienceOn = useCallback(async (exhibitionId?: string) => {
    try {
      engine.current ??= new PinkNoiseEngine();
      await engine.current.start();
      setAmbience("on");
      setAmbienceError(null);
      setMode("AMBIENCE");
      track("ambience_on", { exhibition_id: exhibitionId ?? null });
    } catch (err) {
      setAmbience("error");
      setAmbienceError(
        err instanceof Error ? err.message : "Pink Noise를 재생하지 못했습니다. 다시 시도해 주세요.",
      );
    }
  }, []);

  const ambienceOff = useCallback((exhibitionId?: string) => {
    engine.current?.stop();
    setAmbience("off");
    track("ambience_off", { exhibition_id: exhibitionId ?? null });
  }, []);

  const toggleAmbience = useCallback(
    async (exhibitionId?: string) => {
      if (ambience === "on") ambienceOff(exhibitionId);
      else await ambienceOn(exhibitionId);
    },
    [ambience, ambienceOn, ambienceOff],
  );

  const setModeSafe = useCallback(
    (next: AudioMode) => {
      setMode(next);
      // "No Audio" (and switching to an external playlist) stops the ambience.
      if (next !== "AMBIENCE" && ambience === "on") ambienceOff();
    },
    [ambience, ambienceOff],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      ambience,
      ambienceSupported: supported,
      ambienceError,
      mode,
      setMode: setModeSafe,
      ambienceOn,
      ambienceOff,
      toggleAmbience,
    }),
    [ambience, supported, ambienceError, mode, setModeSafe, ambienceOn, ambienceOff, toggleAmbience],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAudio must be used inside <AudioProvider>");
  return v;
}
