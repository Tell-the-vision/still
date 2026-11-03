import { Stack } from "expo-router";
import { AuthResultNotice } from "../features/auth/AuthResultNotice";
import { ConsentGate } from "../features/auth/ConsentGate";
import { SessionEndedNotice } from "../features/auth/SessionEndedNotice";
import { UpgradeNotice } from "../features/app/UpgradeNotice";
import { RateLimitNotice } from "../features/app/RateLimitNotice";
import { useLoginSuccess } from "../features/auth/useLoginSuccess";
import { TRPCReactProvider } from "../lib/trpc";
import { FontGate } from "../ui/FontGate";

function LoginSuccessTracker() {
  useLoginSuccess();
  return null;
}

export default function RootLayout() {
  return (
    <TRPCReactProvider>
      <LoginSuccessTracker />
      <FontGate>
        <ConsentGate />
        <AuthResultNotice />
        <SessionEndedNotice />
        <UpgradeNotice />
        <RateLimitNotice />
        <Stack screenOptions={{ headerShown: false }} />
      </FontGate>
    </TRPCReactProvider>
  );
}
