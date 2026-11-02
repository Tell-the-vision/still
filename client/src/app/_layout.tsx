import { Stack } from "expo-router";
import { TRPCReactProvider } from "../lib/trpc";
import { FontGate } from "../ui/FontGate";

export default function RootLayout() {
  return (
    <TRPCReactProvider>
      <FontGate>
        <Stack screenOptions={{ headerShown: false }} />
      </FontGate>
    </TRPCReactProvider>
  );
}
