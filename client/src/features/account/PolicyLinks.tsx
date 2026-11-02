import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";
import { STALE_TIME, useTRPC } from "../../lib/trpc";
import { Text } from "../../ui/Text";

// Terms and Privacy links from the current policy (SPEC §2.2 Consent). Opens in a new tab on web.
export function PolicyLinks() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.policy.get.queryOptions(undefined, { staleTime: STALE_TIME.policy }));
  if (!data) return null;
  return (
    <View>
      <Link href={data.termsUrl as never} target="_blank"><Text variant="secondary">Terms of Service</Text></Link>
      <Link href={data.privacyUrl as never} target="_blank"><Text variant="secondary">Privacy Policy</Text></Link>
    </View>
  );
}
