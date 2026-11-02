import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Button } from "../../ui/Button";
import { audioStrings } from "./strings";

const options = [
  { mode: "AUTO", label: audioStrings.auto },
  { mode: "NONE", label: audioStrings.none },
] as const;

// SPEC §6.1: the saved audio choice. Pressing a button saves it.
export function AudioSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.get.queryOptions(undefined, { staleTime: STALE_TIME.personal }));
  const update = useMutation(trpc.settings.update.mutationOptions({ onSuccess: (r) => queryClient.setQueryData(trpc.settings.get.queryKey(), r) }));
  return (
    <>
      {options.map(({ mode, label }) => {
        const selected = data?.audioMode === mode;
        return <Button key={mode} label={label} selected={selected} variant={selected ? "primary" : "secondary"} onPress={() => update.mutate({ audioMode: mode })} />;
      })}
    </>
  );
}
