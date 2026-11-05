import { useQuery } from "@tanstack/react-query";
import { track } from "../../lib/analytics";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../ui/Text";
import { colors, control, focusRing, spacing } from "../../ui/theme";
import { useMe } from "../auth/use-me";
import { displayMode, type Audio } from "./display-mode";
import { audioStrings } from "./strings";
import { focusVisible } from "../../ui/focusVisible";

// The Guide's only audio: a link to the exhibition's playlist when it is EXTERNAL.
// Ambience and No audio belong to the Journal (SPEC §6.3).
export function GuidePlaylist({ code, audio }: { code: string; audio: Audio }) {
  const trpc = useTRPC();
  const me = useMe();
  const settings = useQuery(trpc.settings.get.queryOptions(undefined, { enabled: me !== null, staleTime: STALE_TIME.personal }));
  const playlist = audio.playlist;
  if (!playlist || displayMode(settings.data?.audioMode ?? "AUTO", audio) !== "EXTERNAL") return null;
  return <PlaylistRow code={code} playlist={playlist} />;
}

/** The listen row (SPEC §3): a bordered, full-width link to the playlist on its service, opened in a new tab. */
export function PlaylistRow({ code, playlist }: { code: string; playlist: { provider: string; url: string; title: string } }) {
  const [focused, setFocused] = useState(false);
  const provider = playlist.provider === "SPOTIFY" ? "Spotify" : "Apple Music";
  return (
    <Link href={playlist.url as Href} asChild>
      <Pressable
        {...{ hrefAttrs: { target: "_blank", rel: "noopener noreferrer" } }}
        accessibilityRole="link"
        accessibilityLabel={`Listen to ${playlist.title || "the playlist"} on ${provider}`}
        onPress={() => track("audio_external_click", { provider: playlist.provider, exhibition_code: code })}
        onFocus={() => setFocused(focusVisible())}
        onBlur={() => setFocused(false)}
        style={StyleSheet.flatten([styles.row, focused && focusRing])}
      >
        <View aria-hidden style={styles.play} />
        <View style={styles.text}>
          {!!playlist.title && <Text variant="label" numberOfLines={1}>{playlist.title}</Text>}
          <Text variant="secondary">{playlist.provider === "SPOTIFY" ? audioStrings.playlist.SPOTIFY : audioStrings.playlist.APPLE_MUSIC}</Text>
        </View>
        <Text variant="action" aria-hidden>→</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: "stretch",
    minHeight: control.height,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.gap,
    paddingHorizontal: spacing.inset + 2,
    paddingVertical: spacing.tight,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  // A right-pointing triangle drawn from borders.
  play: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: colors.black,
  },
  text: { flex: 1 },
});
