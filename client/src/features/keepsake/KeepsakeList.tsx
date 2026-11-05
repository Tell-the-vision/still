import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@still/shared/router";
import type { inferRouterOutputs } from "@trpc/server";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { track } from "../../lib/analytics";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { KeepsakeThumb, useFitScale } from "../../ui/KeepsakeThumb";
import { Notice } from "../../ui/Notice";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { card as cardTokens } from "../../ui/theme";
import { DownloadPng } from "./DownloadPng";
import { KeepsakeActions } from "./KeepsakeActions";
import { keepsakeStrings as strings } from "./strings";

type Keepsake = inferRouterOutputs<AppRouter>["keepsake"]["list"][number];

/**
 * Archive Detail's keepsakes: one card per artwork page the visitor made one for, the latest first. Tapping a card
 * edits it; each can be downloaded or deleted. SPEC §11.10: the list is read again a minute before a PNG link expires.
 */
export function KeepsakeList({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: cards } = useQuery({
    ...trpc.keepsake.list.queryOptions({ code }),
    refetchInterval: ({ state }) =>
      state.data?.length ? Math.max(Math.min(...state.data.map((k) => Date.parse(k.png.expiresAt))) - 60_000 - Date.now(), 1000) : false,
  });
  if (cards === undefined) return null;
  if (cards.length === 0) return <Text variant="secondary">{strings.noneYet}</Text>;
  return (
    <Stack gap="section">
      {cards.map((keepsake) => <KeepsakeEntry key={keepsake.page} code={code} keepsake={keepsake} />)}
    </Stack>
  );
}

function KeepsakeEntry({ code, keepsake }: { code: string; keepsake: Keepsake }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { onLayout, scale } = useFitScale();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    trpc.keepsake.delete.mutationOptions({
      onSuccess: () => {
        track("keepsake_delete", { exhibition_code: code, template_id: keepsake.templateId });
        void queryClient.invalidateQueries({ queryKey: trpc.keepsake.pathKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() });
      },
      onSettled: () => setConfirming(false),
    }),
  );
  const edit = () => {
    track("keepsake_open", { exhibition_code: code, source: "archive" });
    router.push(`/archive/${code}/keepsake?from=archive&page=${keepsake.page}`);
  };
  return (
    <Stack>
      <View onLayout={onLayout} style={{ width: "100%", maxWidth: cardTokens.width, alignSelf: "center" }}>
        {scale > 0 && (
          <KeepsakeThumb scale={scale} card={keepsake.card} templateId={keepsake.templateId} accessibilityLabel={strings.thumbEditLabel} accessibilityHint={strings.thumbHint} onPress={edit} />
        )}
      </View>
      <KeepsakeActions align="center">
        <DownloadPng code={code} url={keepsake.png.url} />
        <TextAction label={strings.delete} tone="secondary" onPress={() => setConfirming(true)} />
      </KeepsakeActions>
      {remove.isError && <Notice error message={strings.deleteFailed} />}
      <Dialog visible={confirming} onClose={() => setConfirming(false)} label={strings.delete} body={strings.dialogBody}>
        <Button label={strings.confirm} disabled={remove.isPending} onPress={() => remove.mutate({ code, page: keepsake.page })} />
        <Button label={strings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
      </Dialog>
    </Stack>
  );
}
