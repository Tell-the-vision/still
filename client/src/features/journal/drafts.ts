import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { localStore, sessionStore } from "../../lib/storage";

const DEBOUNCE_MS = 800;

// SPEC §5.3: a guest draft lives in session storage, a user draft in persistent storage.
const draftKey = (code: string, userId: string | null) => `draft:${userId ?? "guest"}:${code}`;
const storeFor = (userId: string | null) => (userId ? localStore : sessionStore);

// `restored` is undefined while loading, null when there is no draft.
export function useDraft(code: string, userId: string | null) {
  const key = draftKey(code, userId);
  const store = storeFor(userId);
  const [restored, setRestored] = useState<string | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string | null>(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current !== null) void store.setItem(key, pending.current);
    pending.current = null;
  }, [store, key]);

  useEffect(() => {
    let active = true;
    setRestored(undefined);
    void store.getItem(key).then((v) => active && setRestored(v));
    const sub = AppState.addEventListener("change", (state) => state !== "active" && flush());
    window.addEventListener?.("pagehide", flush);
    return () => {
      active = false;
      flush();
      sub.remove();
      window.removeEventListener?.("pagehide", flush);
    };
  }, [store, key, flush]);

  const save = (text: string) => {
    pending.current = text;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  };
  const discard = () => {
    clearTimeout(timer.current);
    pending.current = null;
    setRestored(null);
    void store.removeItem(key);
  };
  return { restored, save, flush, discard };
}

// After login the guest's draft is read once and removed; the caller keeps it as the user's draft (SPEC §5.3).
export async function takeGuestDraft(code: string) {
  const key = draftKey(code, null);
  const text = await sessionStore.getItem(key);
  await sessionStore.removeItem(key);
  return text;
}

export async function discardUserDrafts(userId: string) {
  const prefix = `draft:${userId}:`;
  const keys = await localStore.keys();
  await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => localStore.removeItem(k)));
}
