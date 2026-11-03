import { useQuery } from "@tanstack/react-query";
import { track } from "../../lib/analytics";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { TextAction } from "../../ui/TextAction";
import { useMe } from "../auth/use-me";
import { displayMode, type Audio } from "./display-mode";
import { audioStrings } from "./strings";

// The Guide's only audio: a link to the exhibition's playlist when it is EXTERNAL.
// Ambience and No audio belong to the Journal (SPEC §6.3).
export function GuidePlaylist({ code, audio }: { code: string; audio: Audio }) {
  const trpc = useTRPC();
  const me = useMe();
  const settings = useQuery(trpc.settings.get.queryOptions(undefined, { enabled: me !== null, staleTime: STALE_TIME.personal }));
  const playlist = audio.playlist;
  if (!playlist || displayMode(settings.data?.audioMode ?? "AUTO", audio) !== "EXTERNAL") return null;
  return (
    <TextAction
      variant="secondary"
      tone="secondary"
      href={playlist.url}
      target="_blank"
      trailing="→"
      label={playlist.provider === "SPOTIFY" ? audioStrings.playlist.SPOTIFY : audioStrings.playlist.APPLE_MUSIC}
      onPress={() => track("audio_external_click", { provider: playlist.provider, exhibition_code: code })}
    />
  );
}
