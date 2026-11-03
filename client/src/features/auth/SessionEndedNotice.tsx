import { useSessionEnded } from "../../lib/trpc";
import { Banner } from "../../ui/Banner";
import { useMe } from "./use-me";
import { authStrings } from "./strings";

// The ended flag is never reset, so hide the banner once the user has signed in again.
export function SessionEndedNotice() {
  const sessionEnded = useSessionEnded();
  const me = useMe();
  return sessionEnded && !me ? <Banner message={authStrings.sessionEnded} error /> : null;
}
