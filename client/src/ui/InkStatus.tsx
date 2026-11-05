import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform } from "react-native";
import { develop as timing, nativeDriver, reduced as reducedTiming, routine, still, useReduceMotion, type Develop } from "./motion";

// A status line that inks in when its wording changes ("1 line kept" → "2 lines kept"), so the change reads as one.
// Its first wording, and the first one after loading, simply appear. During a develop it is the last thing to settle:
// it counts from the moment the card actually begins, not from the run, so a slow cover never leaves it ahead.
// Opacity never takes it out of the accessibility tree: the live region around it still announces.
export function InkStatus({ label, develop, children }: { label: string; develop?: Develop; children: ReactNode }) {
  const reduce = useReduceMotion() === true;
  const phase = develop?.phase ?? "still";
  const begun = develop?.begun ?? false;
  const [ink] = useState(() => new Animated.Value(1));
  const previous = useRef(label);

  // Like the card: blank from paper, or from mounting in view before the card began, until the surface is still.
  // A status that mounts after the card began (loading → saved) simply shows.
  const [carrying, setCarrying] = useState(false);
  const carry = phase === "paper" || (phase === "run" && (carrying || !begun));
  if (carry !== carrying) setCarrying(carry);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = label;
    if (before === label || before === "" || carrying) return;
    ink.setValue(0);
    Animated.timing(ink, { toValue: 1, duration: reduce ? reducedTiming.status : routine.status, easing: still, useNativeDriver: nativeDriver }).start();
  }, [label]); // Only a change of wording.

  useLayoutEffect(() => {
    ink.stopAnimation();
    ink.setValue(carrying ? 0 : 1);
  }, [carrying, ink]);

  useEffect(() => {
    if (!carrying || !begun) return;
    Animated.timing(ink, {
      toValue: 1,
      delay: reduce ? 0 : timing.status.delay,
      duration: reduce ? reducedTiming.develop : timing.status.duration,
      easing: still,
      useNativeDriver: nativeDriver,
    }).start();
  }, [carrying, begun, ink, reduce]);

  return (
    <Animated.View {...(Platform.OS === "web" ? ({ dataSet: { inkStatus: "" } } as object) : {})} style={{ opacity: ink }}>
      {children}
    </Animated.View>
  );
}
