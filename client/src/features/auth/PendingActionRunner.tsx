import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState } from "react";
import { useTRPC } from "../../lib/trpc";
import { Notice } from "../../ui/Notice";
import { ScreenScrollContext } from "../../ui/Screen";
import { sentenceViews } from "../scrap/SentenceAction";
import { takePendingAction } from "./pending-action";
import { authStrings } from "./strings";
import { useMe } from "./use-me";

// Runs the guest's saved sentence once the user is signed in and has agreed (SPEC §2.2 Sign in 8),
// then scrolls back to it (SPEC §4.5). Renders the expiry notice (SPEC §2.2 Sign in 9). Mount inside a Screen.
export function PendingActionRunner({ code }: { code: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useMe();
  const consent = useQuery(trpc.consent.get.queryOptions(undefined, { enabled: !!me }));
  const upsert = useMutation(trpc.scrap.upsert.mutationOptions());
  const scrollRef = useContext(ScreenScrollContext);
  const [expired, setExpired] = useState(false);
  const ran = useRef(false);
  const ready = !!me && !!consent.data;

  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    void (async () => {
      const action = await takePendingAction({ kind: "SCRAP_SAVE", exhibitionCode: code });
      if (action === "expired") return setExpired(true);
      if (!action) return;
      await upsert.mutateAsync({ code, sentenceId: action.sentenceId }).catch(() => undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
      ]);
      const scroll = scrollRef?.current;
      const content = scroll?.getInnerViewRef();
      if (content) sentenceViews.get(action.sentenceId)?.current?.measureLayout(content, (_x, y) => scroll?.scrollTo({ y, animated: false }));
    })();
  }, [ready, code, upsert, queryClient, trpc, scrollRef]);

  return expired ? <Notice message={authStrings.pendingExpired} /> : null;
}
