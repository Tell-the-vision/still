import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRequireLogin } from "../features/auth/require-login";
import { useLeaveSession, useSignOut } from "../features/auth/sign-out";
import { useTRPC } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { spacing } from "../ui/theme";

const providerNames: Record<string, string> = { GOOGLE: "GOOGLE" };

// Account (Figma 09, SPEC §2.2 Profile).
export default function Account() {
  const me = useRequireLogin("/account");
  const signOut = useSignOut();
  const trpc = useTRPC();
  const leave = useLeaveSession();
  const deleteAccount = useMutation(trpc.me.delete.mutationOptions());
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirmDelete = async () => {
    setConfirming(false);
    try {
      await deleteAccount.mutateAsync();
    } catch {
      setFailed(true);
      return;
    }
    await leave();
  };
  if (!me) return <Screen tabs headerRight>{null}</Screen>;
  return (
    <Screen tabs headerRight>
      <View style={styles.sections}>
        <View>
          <Text variant="label">SIGNED IN WITH {providerNames[me.provider] ?? me.provider}</Text>
          <Text>{me.displayName}</Text>
          <Text>{me.email}</Text>
        </View>
        <View>
          <Text variant="label">PREFERENCES</Text>
        </View>
        <View>
          <Text variant="label">ABOUT STILL</Text>
          <Text>Art stays with you.</Text>
          <Text>A quiet place for what remains after the exhibition ends.</Text>
        </View>
        <View>
          <Text variant="label">ACCOUNT</Text>
          <Button label="Log out →" variant="secondary" onPress={signOut} />
          <Button label="Delete account →" variant="secondary" onPress={() => setConfirming(true)} />
          {failed ? <Notice error message="Your account was not deleted." /> : null}
        </View>
      </View>
      <Dialog visible={confirming} onClose={() => setConfirming(false)}>
        <Text>Your account and all its data will be permanently deleted. This cannot be undone.</Text>
        <Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
        <Button label="Delete" onPress={confirmDelete} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { flex: 1, gap: spacing.gap, paddingTop: spacing.gap },
});
