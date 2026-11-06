import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import { colors, fontFamily, type } from "./theme";

export type TextVariant = keyof typeof type;
const headings: TextVariant[] = ["display", "headline", "title", "subhead", "lede", "docTitle", "docH1", "docH2", "docH3"];
const uppercase: TextVariant[] = ["eyebrow", "caption"];
const grayByDefault: TextVariant[] = ["secondary", "eyebrow", "caption", "cardCaption"];

type Props = TextProps & { variant?: TextVariant; tone?: "primary" | "secondary" };

export function Text({ variant = "body", tone, style, ...props }: Props) {
  const { face, size, line } = type[variant];
  const secondary = (tone ?? (grayByDefault.includes(variant) ? "secondary" : "primary")) === "secondary";
  return (
    <RNText
      role={headings.includes(variant) ? "heading" : undefined}
      maxFontSizeMultiplier={variant === "display" ? 1.5 : undefined}
      style={[
        { fontFamily: fontFamily[face], fontSize: size, lineHeight: line, color: secondary ? colors.gray : colors.black },
        uppercase.includes(variant) && styles.uppercase,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({ uppercase: { textTransform: "uppercase" } });
