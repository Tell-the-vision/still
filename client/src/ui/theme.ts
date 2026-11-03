import { Platform } from "react-native";

import { colors } from "./tokens";

export { card, colors, fontSize, spacing } from "./tokens";

export const control = { height: 52, row: 42, tile: 56 };
export const rule = 1;

// Figma type scale (size / line height). Display faces are Montserrat, text faces DM Sans.
export const type = {
  display: { face: "display", size: 38, line: 45 },
  headline: { face: "display", size: 32, line: 42 },
  title: { face: "display", size: 22, line: 29 },
  subhead: { face: "display", size: 20, line: 27 },
  numeral: { face: "display", size: 36, line: 48 },
  quote: { face: "display", size: 14, line: 19 },
  body: { face: "body", size: 16, line: 24 },
  bodyStrong: { face: "bodyMedium", size: 16, line: 21 },
  row: { face: "body", size: 15, line: 20 },
  action: { face: "body", size: 13, line: 17 },
  label: { face: "bodyMedium", size: 12, line: 16 },
  secondary: { face: "body", size: 11, line: 14 },
  eyebrow: { face: "bodyMedium", size: 9, line: 12 },
  caption: { face: "bodyMedium", size: 8, line: 10 },
} as const;

export const wordmark = {
  header: { size: 20, line: 27, tracking: 5, text: "STILL." },
  hero: { size: 30, line: 40, tracking: 7.5, text: "STILL." },
  card: { size: 10, line: 13, tracking: 0, text: "STILL" },
} as const;

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
