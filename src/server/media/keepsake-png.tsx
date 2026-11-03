import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { card as cardTheme, colors, coverHeight, spacing, type, wordmark } from "../../../client/src/ui/tokens";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
  image: { url: string; width: number; height: number } | null;
};

// The renderer (satori) decodes only PNG and JPEG, told apart by their first bytes.
const isPng = (bytes: Buffer) => bytes[0] === 0x89 && bytes[1] === 0x50;
const isJpeg = (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8;

// SPEC §7.1: the cover is part of the PNG when it can be fetched; any failure means the no-image layout.
// Other cover formats the import accepts (WebP) are converted to PNG first.
async function fetchCover(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (isJpeg(bytes)) return `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const png = isPng(bytes) ? bytes : await sharp(bytes).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// The web card (client/src/ui/KeepsakeCard.tsx) scaled from its theme width up to 1080px.
const scale = 1080 / cardTheme.width;

// Fonts are bundled TTFs from the client workspace, so rendering never fetches them.
// Node's createRequire resolves at runtime, from the client workspace (the bundler would rewrite a bare require.resolve).
const clientRequire = process.getBuiltinModule("node:module").createRequire(path.join(process.cwd(), "client", "package.json"));
const loadFont = (pkg: string, file: string) => {
  const packageJson = clientRequire.resolve(`@expo-google-fonts/${pkg}/package.json`);
  return readFileSync(path.join(path.dirname(packageJson), file));
};
const fonts = [
  { name: "Montserrat", data: loadFont("montserrat", "500Medium/Montserrat_500Medium.ttf"), weight: 500 as const },
  { name: "DM Sans", data: loadFont("dm-sans", "400Regular/DMSans_400Regular.ttf"), weight: 400 as const },
  { name: "DM Sans", data: loadFont("dm-sans", "500Medium/DMSans_500Medium.ttf"), weight: 500 as const },
  { name: "Noto Sans KR", data: loadFont("noto-sans-kr", "400Regular/NotoSansKR_400Regular.ttf"), weight: 400 as const },
];

// The web card's faces (client/src/ui/theme.ts fontFamily); Hangul falls through to Noto Sans KR, as on the web card.
const faces = {
  display: { fontFamily: "Montserrat, Noto Sans KR", fontWeight: 500 },
  body: { fontFamily: "DM Sans, Noto Sans KR", fontWeight: 400 },
  bodyMedium: { fontFamily: "DM Sans, Noto Sans KR", fontWeight: 500 },
} as const;

// A Text variant (client/src/ui/Text.tsx) at PNG scale: same face, size, line height and default tone.
// flexShrink 0 as in React Native (satori defaults to CSS's 1), so only the cover gives way.
function text(variant: "title" | "secondary" | "caption") {
  const { face, size, line } = type[variant];
  return {
    flexShrink: 0,
    ...faces[face],
    fontSize: size * scale,
    lineHeight: `${line * scale}px`,
    color: variant === "title" ? colors.black : colors.gray,
    ...(variant === "caption" && { textTransform: "uppercase" as const }),
  };
}

// The web card's layout (client/src/ui/KeepsakeCard.tsx), scaled: wordmark, cover, title and personal record
// at the top, the caption pinned to the bottom; the cover shrinks, never crops, when the text needs the room.
export async function renderKeepsakePng(card: Card, templateId: string) {
  const { exhibition } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => s.content)
    : templateId === "reflection" ? [card.sentences[0]?.content, card.journalExcerpt].filter((t): t is string => !!t)
    : [];
  const cover = card.image && (await fetchCover(card.image.url));
  const innerWidth = cardTheme.width - 2 * (cardTheme.borderWidth + spacing.gap);
  const mark = wordmark.card;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: spacing.gap * scale, background: colors.white, color: colors.black, border: `${cardTheme.borderWidth * scale}px solid ${colors.black}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.inset * scale, flexShrink: 1, minHeight: 0 }}>
          <div style={{ flexShrink: 0, ...faces.display, fontSize: mark.size * scale, lineHeight: `${mark.line * scale}px`, letterSpacing: mark.tracking * scale }}>{mark.text}</div>
          {card.image && cover && (
            <div style={{ display: "flex", height: coverHeight(innerWidth, card.image) * scale, flexShrink: 1, minHeight: 0 }}>
              {/* satori renders a plain img; next/image does not apply */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          )}
          <div style={text("title")}>{exhibition.title}</div>
          {personal.map((line) => (
            <div key={line} style={text("secondary")}>{line}</div>
          ))}
        </div>
        <div style={text("caption")}>{`${exhibition.venue.city} / ${exhibition.startDate.slice(0, 4)}`}</div>
      </div>
    ),
    { width: 1080, height: 1440, fonts },
  );
}
