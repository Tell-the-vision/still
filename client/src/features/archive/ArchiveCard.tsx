import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { year } from "../../lib/dates";
import { Artwork } from "../../ui/Artwork";
import { Frame } from "../../ui/Frame";
import { Text } from "../../ui/Text";
import { focusRing, spacing } from "../../ui/theme";

type Archive = inferRouterOutputs<AppRouter>["archive"]["list"]["items"][number];

// One grid cell of My Archive (SPEC §8.4): cover, title and "city · year".
export function ArchiveCard({ archive }: { archive: Archive }) {
  const { code, title, venue, startDate, coverImage } = archive.exhibition;
  const [focused, setFocused] = useState(false);
  return (
    <Link href={`/archive/${code}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={StyleSheet.flatten([styles.card, focused && focusRing])}
      >
        {coverImage ? <Artwork url={coverImage.url} altText={null} width={3} height={4} /> : <Frame aspectRatio={3 / 4} />}
        <Text>{title}</Text>
        <Text variant="secondary">{`${venue.city} · ${year(startDate)}`}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.inset, marginBottom: spacing.gap },
});
