import { useQuery } from "@tanstack/react-query";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { TextAction } from "../../ui/TextAction";
import { accountStrings } from "./strings";

// Terms and Privacy links from the current policy (SPEC §2.2 Consent). Opens in a new tab on web.
export function PolicyLinks() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.policy.get.queryOptions(undefined, { staleTime: STALE_TIME.policy }));
  if (!data) return null;
  return (
    <>
      <TextAction variant="secondary" target="_blank" href={data.termsUrl as never} label={accountStrings.terms} trailing="→" />
      <TextAction variant="secondary" target="_blank" href={data.privacyUrl as never} label={accountStrings.privacy} trailing="→" />
    </>
  );
}
