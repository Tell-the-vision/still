import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Artwork } from "../../ui/Artwork";
import { Text } from "../../ui/Text";
import { colors, focusRing, spacing } from "../../ui/theme";

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
        {coverImage ? <Artwork url={coverImage.url} altText={null} width={3} height={4} /> : <View style={styles.empty} />}
        <Text>{title}</Text>
        <Text variant="secondary">{`${venue.city} · ${startDate.slice(0, 4)}`}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.inset, marginBottom: spacing.gap },
  empty: { aspectRatio: 3 / 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.black },
});
