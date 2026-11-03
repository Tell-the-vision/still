import { View } from "react-native";
import { colors, rule, spacing } from "./theme";

// A 1px black divider between groups of content.
// `tight` drops the surrounding space when the content above already sets the rhythm.
export const Rule = ({ tight = false }: { tight?: boolean }) => (
  <View style={{ height: rule, backgroundColor: colors.black, marginVertical: tight ? 0 : spacing.section }} />
);
