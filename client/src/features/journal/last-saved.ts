import { useSyncExternalStore } from "react";

// The most recent journal save in this app session, so the guide footer can show "Saved · HH:MM".
let last: { code: string; at: Date } | null = null;
const listeners = new Set<() => void>();

export function markJournalSaved(code: string) {
  last = { code, at: new Date() };
  listeners.forEach((l) => l());
}

export function formatSavedAt(at: Date) {
  return `Saved · ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

// "Saved · HH:MM" for this exhibition if saved during this visit, else null.
export function useSavedLabel(code: string): string | null {
  const snapshot = useSyncExternalStore(subscribe, () => last);
  return snapshot?.code === code ? formatSavedAt(snapshot.at) : null;
}
