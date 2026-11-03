import { Platform } from "react-native";

import { colors } from "./tokens";

export { card, colors, fontSize, spacing } from "./tokens";

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
