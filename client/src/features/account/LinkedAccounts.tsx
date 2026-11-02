import { useQuery } from "@tanstack/react-query";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Text } from "../../ui/Text";
import { accountStrings } from "./strings";

// Every Google identity linked to this user (SPEC §2.2 Linked accounts).
export function LinkedAccounts() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.identity.list.queryOptions(undefined, { staleTime: STALE_TIME.personal }));
  return (
    <>
      {data?.map((identity) => (
        <Text key={identity.id}>{accountStrings.identityRow("Google", identity.email)}</Text>
      ))}
    </>
  );
}
