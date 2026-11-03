import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Choice } from "../../ui/Choice";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { spacing } from "../../ui/theme";
import { audioStrings } from "./strings";

const options = [
  { mode: "AUTO", label: audioStrings.automatic, hint: audioStrings.automaticHint },
  { mode: "NONE", label: audioStrings.silent, hint: audioStrings.silentHint },
] as const;

// SPEC §6.1: the saved audio choice. Tapping a row saves it.
export function AudioSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.get.queryOptions(undefined, { staleTime: STALE_TIME.personal }));
  const update = useMutation(trpc.settings.update.mutationOptions({ onSuccess: (r) => queryClient.setQueryData(trpc.settings.get.queryKey(), r) }));
  return (
    <View style={styles.list}>
      {options.map(({ mode, label, hint }) => (
        <View key={mode} style={styles.option}>
          <Choice role="radio" label={label} selected={data?.audioMode === mode} onPress={() => update.mutate({ audioMode: mode })} />
          <Text variant="secondary">{hint}</Text>
        </View>
      ))}
      {update.isSuccess ? <Notice message={audioStrings.saved} /> : null}
      {update.isError ? <Notice error message={audioStrings.saveFailed} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.gap },
  option: { gap: spacing.inset },
});
