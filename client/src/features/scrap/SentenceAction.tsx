import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExpandedBlock } from "@still/shared/document";
import { useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { Text } from "../../ui/Text";
import { TextLink } from "../../ui/TextLink";
import { useMe } from "../auth/use-me";
import { scrapStrings } from "./strings";
import { useSavedSentences } from "./useSavedSentences";

type Props = { code: string; sentence: Extract<ExpandedBlock, { type: "sentence" }> };

// Save control under a guide sentence (SPEC §4.1): guests log in, saved sentences show a plain label.
export function SentenceAction({ code, sentence }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useMe();
  const saved = useSavedSentences(code);
  const { mutate, isPending } = useMutation(
    trpc.scrap.upsert.mutationOptions({
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.scrap.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.archive.pathKey() }),
        ]),
    }),
  );
  if (!me) return <TextLink href={{ pathname: "/login", params: { returnTo: `/e/${code}` } }} label={scrapStrings.loginRequired} variant="secondary" />;
  if (saved.has(sentence.sentenceId)) return <Text variant="secondary">{scrapStrings.saved}</Text>;
  return <Button label={scrapStrings.save} variant="secondary" disabled={isPending} onPress={() => mutate({ code, sentenceId: sentence.sentenceId })} />;
}
