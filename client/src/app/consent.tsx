import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { PolicyLinks } from "../features/account/PolicyLinks";
import { useRequireLogin } from "../features/auth/require-login";
import { useLeaveSession } from "../features/auth/sign-out";
import { PUBLIC_PATHS, STALE_TIME, queryPath, useTRPC } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { spacing } from "../ui/theme";

// Paths that stay as they are after consent; everything else is personal data to reload (SPEC §11.10).
const KEEP_PATHS = [...PUBLIC_PATHS, "me.get", "consent.get", "policy.get"];

// Consent (SPEC §2.2 Consent): agree to the current policies, or decline and delete the account.
export default function Consent() {
  const { returnTo = "/" } = useLocalSearchParams<{ returnTo?: string }>();
  const me = useRequireLogin("/consent");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = useLeaveSession();
  const policy = useQuery(trpc.policy.get.queryOptions(undefined, { staleTime: STALE_TIME.policy }));
  const upsert = useMutation(trpc.consent.upsert.mutationOptions());
  const deleteAccount = useMutation(trpc.me.delete.mutationOptions());

  const agree = async () => {
    try {
      const { consent } = await upsert.mutateAsync(policy.data!);
      queryClient.setQueryData(trpc.consent.get.queryKey(), consent);
      await queryClient.invalidateQueries({ predicate: (q) => !KEEP_PATHS.includes(queryPath(q.queryKey)) });
      router.replace(returnTo as never);
    } catch (error) {
      if (error instanceof TRPCClientError && error.data?.appCode === "POLICY_VERSION_OUTDATED") await policy.refetch();
    }
  };
  const decline = async () => {
    await deleteAccount.mutateAsync();
    await leave();
  };

  if (!me) return <Screen>{null}</Screen>;
  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="label">CONSENT</Text>
        <Text>Please agree to the Terms of Service and Privacy Policy to continue.</Text>
        <PolicyLinks />
        <Button label="Agree" onPress={agree} disabled={!policy.data} />
        <Button label="Decline" variant="secondary" onPress={decline} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.gap },
});
