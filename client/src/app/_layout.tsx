import { Stack } from "expo-router";
import { TRPCReactProvider } from "../lib/trpc";

export default function RootLayout() {
  return (
    <TRPCReactProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TRPCReactProvider>
  );
}
