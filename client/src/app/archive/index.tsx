import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList, View } from "react-native";
import { ArchiveCard } from "../../features/archive/ArchiveCard";
import { archiveStrings } from "../../features/archive/strings";
import { useRequireLogin } from "../../features/auth/require-login";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { Screen } from "../../ui/Screen";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { spacing } from "../../ui/theme";
import { useWide } from "../../ui/useWide";
import { useCanScan } from "../../ui/useCanScan";

// My Archive 07: two-column grid, most recently visited first, loading further pages on scroll.
export default function Archive() {
  const wide = useWide();
  const canScan = useCanScan();
  const me = useRequireLogin("/archive");
  const trpc = useTRPC();
  const { data, error, refetch, hasNextPage, fetchNextPage } = useInfiniteQuery(
    trpc.archive.list.infiniteQueryOptions({ limit: 20 }, { getNextPageParam: (page) => page.nextCursor }),
  );
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const totalSize = data?.pages[0]?.totalSize ?? 0;
  const header = (
    <View style={{ gap: spacing.inset, marginBottom: spacing.gutter }}>
      <Text variant="headline">{archiveStrings.heading}</Text>
      <Text variant="eyebrow">{archiveStrings.count(totalSize)}</Text>
    </View>
  );
  return (
    <Screen tabs scroll={false} width="wide">
      {me && error && <Notice error message={archiveStrings.error} action={{ label: archiveStrings.retry, onPress: () => refetch() }} />}
      {me && data && items.length === 0 && (
        <Stack>
          {header}
          <Text variant="subhead">{archiveStrings.emptyTitle}</Text>
          <Text variant="secondary">{archiveStrings.empty}</Text>
          {canScan && <Button label={archiveStrings.scan} href="/scan" />}
        </Stack>
      )}
      {me && items.length > 0 && (
        <FlatList
          data={items}
          key={wide ? "wide" : "narrow"}
          numColumns={wide ? 4 : 2}
          keyExtractor={(item) => item.exhibition.code}
          columnWrapperStyle={{ gap: spacing.gap }}
          contentContainerStyle={{ gap: spacing.section }}
          renderItem={({ item }) => <ArchiveCard archive={item} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          ListHeaderComponent={header}
        />
      )}
    </Screen>
  );
}
