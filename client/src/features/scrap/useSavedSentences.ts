import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { useMe } from "../auth/use-me";

// Ids of the sentences the signed-in user has saved from this exhibition.
export function useSavedSentences(code: string) {
  const trpc = useTRPC();
  const me = useMe();
  const { data } = useQuery({ ...trpc.scrap.list.queryOptions({ code }), enabled: !!me });
  return new Set(data?.map((scrap) => scrap.sentenceId));
}
