import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import { colors, fontFamily } from "./theme";

export type TextVariant = "display" | "title" | "body" | "label" | "secondary";

export function Text({ variant = "body", style, ...props }: TextProps & { variant?: TextVariant }) {
  return <RNText style={[styles[variant], style]} {...props} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: fontFamily.display, fontSize: 40, letterSpacing: 8, color: colors.black },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.black },
  body: { fontFamily: fontFamily.body, fontSize: 16, color: colors.black },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 14, letterSpacing: 1, color: colors.black },
  secondary: { fontFamily: fontFamily.body, fontSize: 14, color: colors.gray },
});
