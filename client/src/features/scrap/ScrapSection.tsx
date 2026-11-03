import { track } from "../../lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryNetworkErrors, useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Notice } from "../../ui/Notice";
import { Section } from "../../ui/Section";
import { Stack } from "../../ui/Stack";
import { Text } from "../../ui/Text";
import { scrapStrings } from "./strings";

// One saved sentence; its unsave shares the save's mutation scope so both are serialized.
function SavedSentence({ code, scrap }: { code: string; scrap: { sentenceId: string; content: string } }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.scrap.list.queryKey({ code });
  const { mutate, isError } = useMutation(
    trpc.scrap.delete.mutationOptions({
      scope: { id: `scrap:${code}:${scrap.sentenceId}` },
      retry: retryNetworkErrors,
      onMutate: async ({ sentenceId }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const snapshot = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, snapshot?.filter((scrap) => scrap.sentenceId !== sentenceId));
        return { snapshot };
      },
      onSuccess: () => track("scrap_remove", { exhibition_code: code, sentence_id: scrap.sentenceId }),
      onError: (_error, _input, context) => queryClient.setQueryData(listKey, context?.snapshot),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
        ]),
    }),
  );
  return (
    <Stack>
      {isError && <Notice message={scrapStrings.unsaveFailed} error />}
      <Text>{scrap.content}</Text>
      <Button label={scrapStrings.unsave} variant="secondary" onPress={() => mutate({ code, sentenceId: scrap.sentenceId })} />
    </Stack>
  );
}

// Archive Detail: the sentences saved from this exhibition. Unsaving happens only here (SPEC §4.2).
export function ScrapSection({ code }: { code: string }) {
  const trpc = useTRPC();
  const { data: scraps = [] } = useQuery(trpc.scrap.list.queryOptions({ code }));
  return (
    <Section label={scrapStrings.savedCount(scraps.length)}>
      <Stack>
        {scraps.map((scrap) => (
          <SavedSentence key={scrap.sentenceId} code={code} scrap={scrap} />
        ))}
      </Stack>
    </Section>
  );
}
