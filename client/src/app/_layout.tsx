import { Stack } from "expo-router";
import { AuthResultNotice } from "../features/auth/AuthResultNotice";
import { SessionEndedNotice } from "../features/auth/SessionEndedNotice";
import { TRPCReactProvider } from "../lib/trpc";
import { FontGate } from "../ui/FontGate";

export default function RootLayout() {
  return (
    <TRPCReactProvider>
      <FontGate>
        <AuthResultNotice />
        <SessionEndedNotice />
        <Stack screenOptions={{ headerShown: false }} />
      </FontGate>
    </TRPCReactProvider>
  );
}
