import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";
import { Button } from "../../ui/Button";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { TextLink } from "../../ui/TextLink";
import { displayMode, type Audio } from "./display-mode";
import { audioStrings } from "./strings";

type Props = { audio: Audio; screen: "guide" };

// SPEC §6.3: the audio offered on a screen. "No audio" here applies to this screen only and is not saved.
export function AudioArea({ audio }: Props) {
  const trpc = useTRPC();
  const me = useMe();
  // A guest has no saved settings and is AUTO.
  const settings = useQuery(trpc.settings.get.queryOptions(undefined, { enabled: me !== null, staleTime: STALE_TIME.personal }));
  const choice = settings.data?.audioMode ?? "AUTO";
  const [muted, setMuted] = useState(false);
  const mode = muted ? "NONE" : displayMode(choice, audio);
  if (!mode) return null;
  const noAudio = <Button label={audioStrings.none} variant="secondary" onPress={() => setMuted(true)} />;
  return (
    <Section label={audioStrings.section}>
      {mode === "EXTERNAL" && audio.playlist && (
        <>
          <TextLink href={audio.playlist.url} target="_blank" label={audio.playlist.provider === "SPOTIFY" ? audioStrings.listen.SPOTIFY : audioStrings.listen.APPLE_MUSIC} />
          {noAudio}
        </>
      )}
      {mode === "AMBIENCE" && (
        <>
          <Text>{audioStrings.ambience}</Text>
          <Text variant="secondary">{audioStrings.ambienceHint}</Text>
          {noAudio}
        </>
      )}
      {mode === "NONE" && (
        <>
          <Text>{audioStrings.none}</Text>
          <Text variant="secondary">{audioStrings.noneHint}</Text>
        </>
      )}
    </Section>
  );
}
