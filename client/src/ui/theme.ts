import { Platform } from "react-native";

import { colors } from "./tokens";

export { card, cardBand, cardText, colors, coverHeight, fontSize, spacing, type, wordmark } from "./tokens";

export const control = { height: 52, row: 42, tile: 56 };
export const rule = 1;
export const pageField = { minHeight: 300 };
export const mark = { square: 20, circle: 22, qr: 22 };

// Web focus ring shared by interactive primitives.
export const focusRing = { outlineWidth: 2, outlineOffset: 2, outlineColor: colors.black, outlineStyle: "solid" } as const;

// Hangul glyphs come from Noto Sans KR. Only web supports a font-family stack;
// native falls back per glyph on its own.
// The Korean fallback uses the same weight as the Latin face (400/500/600/700).
const stack = (latin: string, korean: "400Regular" | "500Medium" | "600SemiBold" | "700Bold") =>
  Platform.OS === "web" ? `${latin}, NotoSansKR_${korean}, sans-serif` : latin;

export const fontFamily = {
  display: stack("Montserrat_500Medium", "500Medium"),
  body: stack("DMSans_400Regular", "400Regular"),
  bodyMedium: stack("DMSans_500Medium", "500Medium"),
  bodySemibold: stack("DMSans_600SemiBold", "600SemiBold"),
};

// QR viewfinder corner brackets (Figma 03).
export const viewfinder = { bracketLength: 42, bracketThickness: 3, bracketInset: 30 };
