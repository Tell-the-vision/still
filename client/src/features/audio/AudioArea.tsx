import { track } from "../../lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";
import { Choice } from "../../ui/Choice";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { Stack } from "../../ui/Stack";
import { spacing } from "../../ui/theme";
import { View } from "react-native";
import { displayMode, type Audio } from "./display-mode";
import { AmbienceToggle } from "./AmbienceToggle";
import { audioStrings } from "./strings";

type Props = { code: string; audio: Audio; screen: "guide" | "journal"; onModeChange?: (mode: ReturnType<typeof displayMode>) => void };

// SPEC §6.3: the audio offered on a screen. "No audio" here applies to this screen only and is not saved.
export function AudioArea({ code, audio, screen, onModeChange }: Props) {
  const trpc = useTRPC();
  const me = useMe();
  // A guest has no saved settings and is AUTO.
  const settings = useQuery(trpc.settings.get.queryOptions(undefined, { enabled: me !== null, staleTime: STALE_TIME.personal }));
  const choice = settings.data?.audioMode ?? "AUTO";
  const focused = useIsFocused();
  // The one selection: PLAY is the offered audio, NONE is silence. Until the user picks, Ambience is off and a playlist is on.
  const [picked, setPicked] = useState<"PLAY" | "NONE" | null>(null);
  const base = displayMode(choice, audio);
  const sound = picked ?? (base === "EXTERNAL" ? "PLAY" : "NONE");
  const mode = sound === "NONE" ? "NONE" : base;
  const play = useCallback(() => setPicked("PLAY"), []);
  const silence = useCallback(() => setPicked("NONE"), []);
  useEffect(() => onModeChange?.(mode), [mode, onModeChange]);
  if (!base) return null;
  const playlist = audio.playlist;
  return (
    <Section label={audioStrings.groupLabel} hideLabel>
      <Stack gap="tight">
        <View role="radiogroup" aria-label={audioStrings.groupLabel} style={{ gap: spacing.tight }}>
          {base === "EXTERNAL" && playlist && (
            <Choice
              role="button"
              href={playlist.url}
              target="_blank"
              selected={sound === "PLAY"}
              label={playlist.provider === "SPOTIFY" ? audioStrings.listen.SPOTIFY : audioStrings.listen.APPLE_MUSIC}
              onPress={() => {
                play();
                track("audio_external_click", { provider: playlist.provider, exhibition_code: code });
              }}
            />
          )}
          {base === "AMBIENCE" && focused && <AmbienceToggle code={code} selected={sound === "PLAY"} onSelect={play} onStop={silence} />}
          <Choice role="radio" label={audioStrings.none} selected={sound === "NONE"} onPress={silence} />
        </View>
        {mode === "NONE" && <Text variant="secondary">{audioStrings.noneHint}</Text>}
      </Stack>
    </Section>
  );
}
