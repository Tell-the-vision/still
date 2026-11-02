import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { TextLink } from "../../ui/TextLink";
import { accountStrings } from "./strings";

// Terms and Privacy links from the current policy (SPEC §2.2 Consent). Opens in a new tab on web.
export function PolicyLinks() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.policy.get.queryOptions(undefined, { staleTime: STALE_TIME.policy }));
  if (!data) return null;
  return (
    <View>
      <TextLink variant="secondary" target="_blank" href={data.termsUrl as never} label={accountStrings.terms} />
      <TextLink variant="secondary" target="_blank" href={data.privacyUrl as never} label={accountStrings.privacy} />
    </View>
  );
}
