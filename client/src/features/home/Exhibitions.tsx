import AsyncStorage from "@react-native-async-storage/async-storage";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { shortRange } from "../../lib/dates";
import { useTRPC } from "../../lib/trpc";
import { Artwork } from "../../ui/Artwork";
import { Notice } from "../../ui/Notice";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { spacing } from "../../ui/theme";
import { useWide } from "../../ui/useWide";
import { homeStrings } from "./strings";

type Scope = "ON_VIEW" | "ALL";
const SCOPE_KEY = "home.exhibitionScope";

// The chosen scope is remembered on the device.
function useScope() {
  const [scope, setScope] = useState<Scope>("ON_VIEW");
  useEffect(() => {
    AsyncStorage.getItem(SCOPE_KEY).then((stored) => {
      if (stored === "ALL") setScope("ALL");
    });
  }, []);
  const choose = (next: Scope) => {
    setScope(next);
    void AsyncStorage.setItem(SCOPE_KEY, next);
  };
  return [scope, choose] as const;
}

const prefix = { ON_VIEW: "", UPCOMING: `${homeStrings.upcoming} · `, ENDED: `${homeStrings.ended} · ` };

// Home 02: published exhibitions, filtered to those on view or all of them.
export function Exhibitions() {
  const trpc = useTRPC();
  const wide = useWide();
  const { width } = useWindowDimensions();
  const [scope, choose] = useScope();
  const { data, isError, refetch } = useQuery({ ...trpc.exhibition.list.queryOptions({ scope }), placeholderData: keepPreviousData });
  const columns = !wide ? 1 : width >= 1440 ? 4 : 3;

  return (
    <Stack gap="inset">
      <Stack direction="row" align="center" justify="space-between">
        <Text variant="eyebrow">{homeStrings.exhibitions}</Text>
        <View role="radiogroup" aria-label={homeStrings.filterLabel} style={{ flexDirection: "row", gap: spacing.section }}>
          {([["ON_VIEW", homeStrings.onView], ["ALL", homeStrings.all]] as const).map(([value, label]) => (
            <TextAction key={value} label={label} variant="label" tone={scope === value ? "primary" : "secondary"} active={scope === value} onPress={() => choose(value)} />
          ))}
        </View>
      </Stack>
      {isError && !data ? (
        <Notice error message={homeStrings.error} action={{ label: homeStrings.retry, onPress: () => void refetch() }} />
      ) : data && data.items.length === 0 ? (
        <Stack gap="inset" align="flex-start">
          <Text variant="secondary">{homeStrings.emptyOnView}</Text>
          <TextAction label={homeStrings.seeAll} onPress={() => choose("ALL")} />
        </Stack>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -spacing.gutter }}>
          {data?.items.map(({ code, title, venue, startDate, endDate, coverImage, availability }) => (
            <View key={code} style={{ width: `${100 / columns}%`, paddingRight: spacing.gutter, paddingBottom: spacing.section }}>
              <Link href={`/e/${code}`} asChild>
                <Pressable accessibilityRole="link">
                  <Stack gap="inset">
                    {coverImage && <Artwork {...coverImage} />}
                    <Text variant="title">{title}</Text>
                    <Text variant="secondary">{`${prefix[availability]}${venue.name} · ${shortRange(startDate, endDate)}`}</Text>
                  </Stack>
                </Pressable>
              </Link>
            </View>
          ))}
        </View>
      )}
    </Stack>
  );
}
