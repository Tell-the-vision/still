import { useState } from "react";
import { Button } from "../../ui/Button";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { TextLink } from "../../ui/TextLink";
import { displayMode, type Audio } from "./display-mode";
import { audioStrings } from "./strings";

type Props = { audio: Audio; screen: "guide"; choice?: "AUTO" | "NONE" };

// SPEC §6.3: the audio offered on a screen. "No audio" here applies to this screen only and is not saved.
export function AudioArea({ audio, choice = "AUTO" }: Props) {
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
