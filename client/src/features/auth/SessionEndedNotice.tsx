import { useSessionEnded } from "../../lib/trpc";
import { Notice } from "../../ui/Notice";
import { authStrings } from "./strings";

export function SessionEndedNotice() {
  return useSessionEnded() ? <Notice message={authStrings.sessionEnded} error /> : null;
}
