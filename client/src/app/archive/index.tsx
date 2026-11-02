import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet } from "react-native";
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

// My Archive 07: two-column grid, most recently visited first, loading further pages on scroll.
export default function Archive() {
  const me = useRequireLogin("/archive");
  const trpc = useTRPC();
  const { data, error, refetch, hasNextPage, fetchNextPage } = useInfiniteQuery(
    trpc.archive.list.infiniteQueryOptions({ limit: 20 }, { getNextPageParam: (page) => page.nextCursor }),
  );
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const totalSize = data?.pages[0]?.totalSize ?? 0;
  return (
    <Screen tabs headerRight scroll={false}>
      {me && error && (
        <Stack>
          <Notice error message={archiveStrings.error} />
          <Button label={archiveStrings.retry} onPress={() => refetch()} />
        </Stack>
      )}
      {me && data && items.length === 0 && (
        <Stack centered>
          <Text>{archiveStrings.empty}</Text>
          <Button label={archiveStrings.scan} href="/scan" />
        </Stack>
      )}
      {me && items.length > 0 && (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.exhibition.code}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => <ArchiveCard archive={item} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          ListHeaderComponent={
            <>
              <Text variant="title">{archiveStrings.heading}</Text>
              <Text variant="label">{archiveStrings.count(totalSize)}</Text>
            </>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { gap: spacing.gap } });
