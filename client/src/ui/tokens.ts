// Platform-free design tokens, importable by the server (the PNG route) as well as the app.
// SPEC §0.3: monochrome palette, gray only for secondary text.
export const colors = { white: "#FFFFFF", black: "#000000", gray: "#666666", placeholder: "#EDEDED" };
export const spacing = { gutter: 24, gap: 16, inset: 12, tight: 8, section: 32, headerTop: 22, headerHeight: 44, contentTop: 34 };
export const fontSize = { body: 16, small: 14, title: 24 };

// Figma type scale (size / line height). Display faces are Montserrat, text faces DM Sans.
// Here rather than in theme.ts so the keepsake PNG draws the same type as the web card.
export const type = {
  display: { face: "display", size: 38, line: 45 },
  headline: { face: "display", size: 32, line: 42 },
  title: { face: "display", size: 22, line: 29 },
  subhead: { face: "display", size: 18, line: 23.9 },
  lede: { face: "display", size: 14, line: 18.6 },
  numeral: { face: "display", size: 36, line: 48 },
  quote: { face: "display", size: 14, line: 18.6 },
  body: { face: "body", size: 16, line: 24 },
  bodyStrong: { face: "bodyMedium", size: 16, line: 21 },
  row: { face: "body", size: 15, line: 20 },
  action: { face: "body", size: 13, line: 17 },
  label: { face: "bodyMedium", size: 12, line: 16 },
  secondary: { face: "body", size: 11, line: 14 },
  // Functional text stays at 11px or more (impeccable legibility floor): eyebrows label navigation and
  // sections, captions describe images. Was 9px and 8px.
  eyebrow: { face: "bodyMedium", size: 11, line: 14 },
  caption: { face: "bodyMedium", size: 11, line: 15 },
  // The keepsake card is artwork rendered at its own scale (and exported as a PNG); its caption keeps the
  // original size there.
  cardCaption: { face: "bodyMedium", size: 8, line: 10 },
} as const;

export const wordmark = {
  header: { size: 20, line: 27, tracking: 5, text: "STILL." },
  hero: { size: 30, line: 40, tracking: 7.5, text: "STILL." },
  card: { size: 12, line: 16, tracking: 3, text: "STILL." },
} as const;

// Keepsake card: a 3:4 sheet, 360 wide by default, with a black band along its foot that carries the wordmark and
// where and when, like a gallery label. `padding` is the sheet's margin around the words and a framed picture.
export const card = { width: 360, aspectRatio: 3 / 4, borderWidth: 1, padding: 20, band: 44 };

// The card's cover keeps its shape at full width, and shrinks (never crops) when the text needs the room,
// so the web card and the PNG show the same words (SPEC §7.3). Both draw it from this height.
export const coverHeight = (innerWidth: number, image: { width: number; height: number }) => (innerWidth * image.height) / image.width;

// How each part of a keepsake card is set (shared/src/keepsake.ts cardBlocks names them), for the web card and the PNG
// alike: a type variant above, gray for what stands aside, and a hairline above each kept line of a list.
export const cardText = {
  title: { variant: "title", gray: false, rule: false },
  titleSmall: { variant: "label", gray: false, rule: false },
  quote: { variant: "headline", gray: false, rule: false },
  quoteLong: { variant: "title", gray: false, rule: false },
  note: { variant: "title", gray: false, rule: false },
  noteLong: { variant: "subhead", gray: false, rule: false },
  noteAside: { variant: "row", gray: false, rule: false },
  line: { variant: "subhead", gray: false, rule: true },
  lineAside: { variant: "quote", gray: true, rule: false },
  placeholder: { variant: "secondary", gray: true, rule: false },
} as const;
// The band's "CITY · YEAR": small capitals, spaced.
export const cardBand = { size: 9, line: 12, tracking: 1.5 };
