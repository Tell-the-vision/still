import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, isUnauthorized, type PlatformAdmin } from "./api";

// Operator sign-in state for the platform admin app (see pages/SignIn.tsx).
// "error": the server could not be reached; the shell still shows, pages report it.
type Status = "loading" | "ready" | "signed-out" | "error";

function useAuthState() {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<PlatformAdmin | null>(null);
  // Bumped by every sign-in/sign-out, so a slow first getMe cannot overwrite what happened after it.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const at = generation.current;
    try {
      const loaded = await api.getMe();
      if (at !== generation.current) return;
      setMe(loaded);
      setStatus("ready");
    } catch (e) {
      if (at !== generation.current) return;
      setMe(null);
      setStatus(isUnauthorized(e) ? "signed-out" : "error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const signedOut = () => { generation.current++; setMe(null); setStatus("signed-out"); };

  return {
    status, me,
    signIn: async (email: string, password: string) => {
      const signedIn = await api.signIn(email, password);
      generation.current++;
      setMe(signedIn);
      setStatus("ready");
    },
    changePassword: async (current: string, next: string) => {
      await api.changePassword(current, next);
      setMe((m) => (m ? { ...m, mustChangePassword: false } : m));
    },
    // A session that already ended (UNAUTHORIZED) counts as signed out; any other failure goes to the caller.
    signOut: async () => {
      try {
        await api.signOut();
      } catch (e) {
        if (!isUnauthorized(e)) throw e;
      }
      signedOut();
    },
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
