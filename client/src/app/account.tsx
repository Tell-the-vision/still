import { track } from "../lib/analytics";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { audioStrings } from "../features/audio/strings";
import { LinkedAccounts } from "../features/account/LinkedAccounts";
import { PolicyLinks } from "../features/account/PolicyLinks";
import { accountStrings } from "../features/account/strings";
import { useRequireLogin } from "../features/auth/require-login";
import { useLeaveSession, useSignOut } from "../features/auth/sign-out";
import { useTRPC } from "../lib/trpc";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Notice } from "../ui/Notice";
import { Screen } from "../ui/Screen";
import { Rule } from "../ui/Rule";
import { Section } from "../ui/Section";
import { Stack } from "../ui/Stack";
import { Text } from "../ui/Text";
import { TextAction } from "../ui/TextAction";

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
    track("account_delete", {});
    await leave();
  };
  const title = <Text variant="headline">{accountStrings.title}</Text>;
  if (!me) return <Screen tabs>{title}</Screen>;
  return (
    <Screen tabs>
      <Stack>
        {title}
        <Section label={accountStrings.signedInWith(providerNames[me.provider] ?? me.provider)}>
          <Text variant="bodyStrong">{me.displayName}</Text>
          <Text tone="secondary" numberOfLines={1} ellipsizeMode="middle">{me.email}</Text>
        </Section>
        <Rule />
        <Section label={accountStrings.preferences}>
          <TextAction href="/account/audio" label={audioStrings.settingsLink} trailing="→" />
        </Section>
        <Rule />
        <Section label={accountStrings.linkedAccounts}>
          <LinkedAccounts />
        </Section>
        <Rule />
        <Section label={accountStrings.about}>
          <Text variant="subhead">{accountStrings.tagline}</Text>
          <Text tone="secondary">{accountStrings.aboutBody}</Text>
          <PolicyLinks />
        </Section>
        <Rule />
        <Section label={accountStrings.account}>
          <TextAction label={accountStrings.logOut} trailing="→" disabled={signingOut} onPress={logOut} />
          <TextAction label={accountStrings.deleteAccount} trailing="→" tone="secondary" disabled={deleteAccount.isPending} onPress={() => setConfirming(true)} />
          {failed ? <Notice error message={accountStrings.deleteFailed} /> : null}
        </Section>
      </Stack>
      <Dialog label={accountStrings.deleteDialogLabel} body={accountStrings.deleteWarning} visible={confirming} onClose={() => setConfirming(false)}>
        <Button label={accountStrings.delete} disabled={deleteAccount.isPending} onPress={confirmDelete} />
        <Button label={accountStrings.cancel} variant="secondary" onPress={() => setConfirming(false)} />
      </Dialog>
    </Screen>
  );
}
