import { View } from "react-native";
import { colors, rule, spacing } from "./theme";

// A 1px black divider between groups of content.
export const Rule = () => <View style={{ height: rule, backgroundColor: colors.black, marginVertical: spacing.section }} />;
