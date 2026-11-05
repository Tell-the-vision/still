import { useFocusEffect } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { develop as timing, useReduceMotion, type Develop, type DevelopPhase } from "../../ui/motion";

// Where a saved card can develop: the keepsake panel on its artwork's page, or its card on Archive Detail.
export type DevelopSurface = "guide" | "archive";

// One saved version per card, and the surfaces that still owe it a develop. A card is keyed "{code}/{page}" (each
// artwork page has its own). Memory only: a reload never replays it.
// `at` is when the save landed.
const kept = new Map<string, { updatedAt: string; at: number; pending: Set<DevelopSurface> }>();

// Called when a save lands. From the guide, the guide's thumbnail develops, and Archive Detail
// develops once the first time it shows this version (the echo).
export function markKept(code: string, updatedAt: string, from: DevelopSurface) {
  kept.set(code, { updatedAt, at: Date.now(), pending: new Set(from === "guide" ? ["guide", "archive"] : ["archive"]) });
}

export function peekDevelop(code: string, keptAt: string | undefined, surface: DevelopSurface) {
  const entry = kept.get(code);
  return keptAt !== undefined && entry?.updatedAt === keptAt && entry.pending.has(surface);
}

// Idempotent, so React's doubled effects are safe.
export function takeDevelop(code: string, keptAt: string | undefined, surface: DevelopSurface) {
  if (peekDevelop(code, keptAt, surface)) kept.get(code)?.pending.delete(surface);
}

// The develop for one surface showing the saved version `keptAt`. Paper is laid down only where the visitor
// hasn't seen the new card yet: on mount, or for a version saved while this screen was hidden (from the editor above it).
export function useDevelop(code: string, keptAt: string | undefined, surface: DevelopSurface): Develop {
  const reduce = useReduceMotion();
  const [phase, setPhase] = useState<DevelopPhase>(() => (peekDevelop(code, keptAt, surface) ? "paper" : "still"));
  const [begun, setBegun] = useState(false);
  // When the current view of this screen began, or null while it is hidden.
  const focusedAt = useRef<number | null>(null);
  const shown = useRef(keptAt);

  // A version saved while this screen was hidden: paper before it paints. The cache can tell the screen a
  // moment after it is back in view, so this asks when the save landed, not when the news arrived.
  // A version saved during this view is spent silently: a card the visitor is looking at never blanks.
  useLayoutEffect(() => {
    if (shown.current === keptAt) return;
    shown.current = keptAt;
    if (!peekDevelop(code, keptAt, surface)) return;
    const savedAt = kept.get(code)?.at ?? 0;
    if (focusedAt.current === null || savedAt <= focusedAt.current) {
      setBegun(false);
      setPhase("paper");
    } else {
      takeDevelop(code, keptAt, surface);
    }
  }, [code, keptAt, surface]);

  useFocusEffect(
    useCallback(() => {
      focusedAt.current = Date.now();
      return () => {
        focusedAt.current = null;
      };
    }, []),
  );

  // In view on paper: run from the next frame.
  useFocusEffect(
    useCallback(() => {
      if (phase !== "paper" || reduce === undefined) return;
      const frame = requestAnimationFrame(() => {
        takeDevelop(code, keptAt, surface);
        setPhase("run");
      });
      return () => cancelAnimationFrame(frame);
    }, [phase, reduce, code, keptAt, surface]),
  );

  // A blank sheet never stays in view past the safety: if no card has begun by then, it is simply there.
  const waiting = phase !== "still" && !begun;
  useFocusEffect(
    useCallback(() => {
      if (!waiting) return;
      const safety = setTimeout(() => {
        takeDevelop(code, keptAt, surface);
        setPhase("still");
      }, timing.safety);
      return () => clearTimeout(safety);
    }, [waiting, code, keptAt, surface]),
  );

  // Leaving mid-run (blur, unmount, opening the editor): the card completes at once.
  useFocusEffect(
    useCallback(() => {
      if (phase !== "run") return;
      return () => setPhase((p) => (p === "run" ? "still" : p));
    }, [phase]),
  );

  const onBegin = useCallback(() => setBegun(true), []);
  // The run is over: back to still, so nothing that mounts later replays it.
  const onDone = useCallback(() => setPhase((p) => (p === "run" ? "still" : p)), []);
  return useMemo(() => ({ phase, begun, onBegin, onDone }), [phase, begun, onBegin, onDone]);
}
