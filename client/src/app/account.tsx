import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { PolicyLinks } from "../features/account/PolicyLinks";
import { accountStrings } from "../features/account/strings";
import { useRequireLogin } from "../features/auth/require-login";
import { useLeaveSession, useSignOut } from "../features/auth/sign-out";
import { useTRPC } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
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
  const [signingOut, setSigningOut] = useState(false);
  const logOut = async () => {
    setSigningOut(true);
    await signOut();
  };
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
        <Section label={accountStrings.signedInWith(providerNames[me.provider] ?? me.provider)}>
          <Text>{me.displayName}</Text>
          <Text>{me.email}</Text>
        </Section>
        <Section label={accountStrings.preferences} />
        <Section label={accountStrings.about}>
          <Text>{accountStrings.tagline}</Text>
          <Text>{accountStrings.aboutBody}</Text>
          <PolicyLinks />
        </Section>
        <Section label={accountStrings.account}>
          <Button label={accountStrings.logOut} trailing="→" variant="secondary" disabled={signingOut} onPress={logOut} />
          <Button label={accountStrings.deleteAccount} trailing="→" variant="secondary" disabled={deleteAccount.isPending} onPress={() => setConfirming(true)} />
          {failed ? <Notice error message={accountStrings.deleteFailed} /> : null}
        </Section>
      </View>
      <Dialog label={accountStrings.deleteDialogLabel} visible={confirming} onClose={() => setConfirming(false)}>
        <Text>{accountStrings.deleteWarning}</Text>
        <Button label={accountStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
        <Button label={accountStrings.delete} disabled={deleteAccount.isPending} onPress={confirmDelete} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { flex: 1, gap: spacing.gap, paddingTop: spacing.gap },
});
