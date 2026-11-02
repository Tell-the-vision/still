import { Platform } from "react-native";

// SPEC §0.3: monochrome palette, gray only for secondary text.
export const colors = { white: "#FFFFFF", black: "#000000", gray: "#666666" };
export const spacing = { gutter: 24, gap: 16, inset: 12 };
export const fontSize = { body: 16 };

// Web focus ring shared by interactive primitives.
export const focusRing = { outlineWidth: 2, outlineOffset: 2, outlineColor: colors.black, outlineStyle: "solid" } as const;

// Hangul glyphs come from Noto Sans KR. Only web supports a font-family stack;
// native falls back per glyph on its own.
const stack = (latin: string) =>
  Platform.OS === "web" ? `${latin}, NotoSansKR_400Regular, sans-serif` : latin;

export const fontFamily = {
  display: stack("Montserrat_500Medium"),
  body: stack("DMSans_400Regular"),
  bodyMedium: stack("DMSans_500Medium"),
};
