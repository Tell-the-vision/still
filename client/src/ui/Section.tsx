import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";

// A labelled group of content; the label is a heading for screen readers.
export function Section({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <View>
      <Text variant="label" role="heading">{label}</Text>
      {children}
    </View>
  );
}
