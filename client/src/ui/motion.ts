import { useEffect, useState } from "react";
import { AccessibilityInfo, Easing, Platform } from "react-native";

// STILL's one easing: an exponential ease-out. Things arrive and settle; nothing bounces.
export const still = Easing.bezier(0.16, 1, 0.3, 1);

// The cover's develop: the same exponential ease-out, gentler (2^-2x, normalised), so the print keeps
// visibly coming up through the whole run instead of spending it in an invisible tail.
export const tray = (x: number) => (1 - 2 ** (-2 * x)) / (1 - 2 ** -2);

// Opacity runs on the native driver where there is one. Web has only the JS driver.
export const nativeDriver = Platform.OS !== "web";

// A card's develop: `still` is the card at rest, `paper` the blank sheet waiting to be seen, `run` developing.
export type DevelopPhase = "still" | "paper" | "run";

// One surface's develop (features/keepsake/develop.ts). The card carrying it reports when it actually
// begins (after waiting for its cover) and when it is done; done returns the surface to `still`, so a card
// or status that mounts afterwards never replays it. `begun` lets the status count from the card's real start.
export type Develop = { phase: DevelopPhase; begun: boolean; onBegin: () => void; onDone: () => void };

// The develop: a saved keepsake comes up like a print in the tray (ms from the moment the card begins).
// Paper first, then the cover's shadows, the title, the lines one after another, and the date last.
export const develop = {
  induction: 80,
  cover: { delay: 80, duration: 680 },
  title: { delay: 200, duration: 440 },
  line: { delay: 360, stagger: 60, duration: 360, maxStagger: 2 },
  caption: { delay: 480, duration: 360 },
  // Starts last and is settled before the card reports done, so done never cuts it short.
  status: { delay: 560, duration: 240 },
  // How long the card waits for a cover that hasn't loaded yet, and how long a blank sheet may stay in view.
  coverWait: 250,
  safety: 1000,
};

// Quiet supporting states: each explains one change and is over in a moment.
export const routine = { lineIn: 240, reink: 200, status: 200 };

// Reduce motion: one short opacity change, no stagger, no filter.
export const reduced = { develop: 240, lineIn: 150, reink: 150, status: 150 };

// The OS setting, read once at import and kept current (on web, `prefers-reduced-motion`).
let reduceMotion: boolean | undefined;
const listeners = new Set<(value: boolean) => void>();
const update = (value: boolean) => {
  reduceMotion = value;
  listeners.forEach((listener) => listener(value));
};
void AccessibilityInfo.isReduceMotionEnabled().then(update, () => update(false));
AccessibilityInfo.addEventListener("reduceMotionChanged", update);

// `undefined` until the setting is known.
export function useReduceMotion(): boolean | undefined {
  const [value, setValue] = useState(reduceMotion);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduceMotion);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
