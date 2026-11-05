import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, isUnauthorized, type PlatformAdmin } from "./api";

// Operator sign-in state for the platform admin app (see pages/SignIn.tsx).
// "error": the server could not be reached or has no platform.* yet; the shell still shows, pages report it.
type Status = "loading" | "ready" | "signed-out" | "error";

function useAuthState() {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<PlatformAdmin | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await api.getMe());
      setStatus("ready");
    } catch (e) {
      setMe(null);
      setStatus(isUnauthorized(e) ? "signed-out" : "error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return {
    status, me,
    signIn: async (email: string, password: string) => { setMe(await api.signIn(email, password)); setStatus("ready"); },
    changePassword: async (current: string, next: string) => {
      await api.changePassword(current, next);
      setMe((m) => (m ? { ...m, mustChangePassword: false } : m));
    },
    signOut: async () => { await api.signOut(); setMe(null); setStatus("signed-out"); },
  };
}

const Ctx = createContext<ReturnType<typeof useAuthState> | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useAuthState()}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
