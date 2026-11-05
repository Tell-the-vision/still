import { useEffect, useRef } from "react";

// After a suggestion is decided its card unmounts and focus would be lost. Call `before(id)` when deciding:
// focus then moves to the next open suggestion's Accept button (`data-accept`), or to the heading when none is left.
export function useDecisionFocus(open: { id: string }[]) {
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (pending.current === undefined) return;
    const next = pending.current === null ? null : document.querySelector<HTMLElement>(`[data-accept="${pending.current}"]`);
    pending.current = undefined;
    (next ?? heading.current)?.focus();
  }, [open]);
  const before = (id: string) => {
    const i = open.findIndex((s) => s.id === id);
    pending.current = (open[i + 1] ?? open[i - 1])?.id ?? null;
  };
  return { heading, before };
}
