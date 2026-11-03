import { useEffect } from "react";
import { track } from "../../lib/analytics";
import { sessionStore } from "../../lib/storage";
import { useMe } from "./use-me";

const LOGIN_STARTED = "still:login-started";

export const markLoginStarted = () => sessionStore.setItem(LOGIN_STARTED, "1");
export const clearLoginStarted = () => sessionStore.removeItem(LOGIN_STARTED);

// Web returns from Google as a fresh page load: the first signed-in `me` after a started login is the success.
export function useLoginSuccess() {
  const me = useMe();
  useEffect(() => {
    if (!me) return;
    void (async () => {
      if (!(await sessionStore.getItem(LOGIN_STARTED))) return;
      await clearLoginStarted();
      track("login_success", { provider: "GOOGLE" });
    })();
  }, [me]);
}
