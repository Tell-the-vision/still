// Platform-free design tokens, importable by the server (the PNG route) as well as the app.
// SPEC §0.3: monochrome palette, gray only for secondary text.
export const colors = { white: "#FFFFFF", black: "#000000", gray: "#666666" };
export const spacing = { gutter: 24, gap: 16, inset: 12 };
export const fontSize = { body: 16, small: 14, title: 24 };

// Keepsake card: a 3:4 sheet, 360 wide by default.
export const card = { width: 360, aspectRatio: 3 / 4, borderWidth: 1 };
