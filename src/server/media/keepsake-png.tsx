import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cardBlocks } from "@still/shared/keepsake";
import { card as cardTheme, cardBand, cardText, colors, coverHeight, spacing, type, wordmark } from "../../../client/src/ui/tokens";

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

// A Text variant (client/src/ui/Text.tsx) at PNG scale: same face, size and line height; gray only where the web card
// is gray. flexShrink 0 as in React Native (satori defaults to CSS's 1), so only the picture gives way.
function text(variant: keyof typeof type, gray = false) {
  const { face, size, line } = type[variant];
  return { flexShrink: 0, ...faces[face], fontSize: size * scale, lineHeight: `${line * scale}px`, color: gray ? colors.gray : colors.black };
}

// The web card's layout (client/src/ui/KeepsakeCard.tsx), scaled: the template's blocks (cardBlocks) on the sheet, the
// band along the foot; the picture shrinks, never crops, when the text needs the room.
export async function renderKeepsakePng(card: Card, templateId: string) {
  const { exhibition } = card;
  const blocks = cardBlocks({ title: exhibition.title, image: card.image, sentences: card.sentences, journalExcerpt: card.journalExcerpt }, templateId);
  const cover = card.image && (await fetchCover(card.image.url));
  const sheet = cardTheme.width - 2 * cardTheme.borderWidth;
  const pad = cardTheme.padding * scale;
  const mark = wordmark.card;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: colors.white, color: colors.black, border: `${cardTheme.borderWidth * scale}px solid ${colors.black}` }}>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, minHeight: 0, padding: pad, gap: (spacing.inset + 2) * scale, overflow: "hidden" }}>
          {blocks.map((block, i) => {
            if (block.kind === "picture") {
              if (!card.image || !cover) return null;
              const width = block.full ? sheet : sheet - 2 * cardTheme.padding;
              return (
                <div key={`picture-${i}`} style={{ display: "flex", height: coverHeight(width, card.image) * scale, flexShrink: 1, minHeight: 0, marginLeft: block.full ? -pad : 0, marginRight: block.full ? -pad : 0, marginTop: block.full && block.first ? -pad : 0, background: block.full ? colors.placeholder : "transparent" }}>
                  {/* satori renders a plain img; next/image does not apply */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              );
            }
            const { variant, gray, rule } = cardText[block.role];
            return (
              <div key={block.id} style={{ display: "flex", flexShrink: 0, ...(rule && { borderTop: `${scale}px solid ${colors.black}`, paddingTop: spacing.tight * scale }) }}>
                <div style={text(variant, gray)}>{block.text}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexShrink: 0, height: cardTheme.band * scale, alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px`, background: colors.black, color: colors.white }}>
          <div style={{ ...faces.display, fontSize: mark.size * scale, lineHeight: `${mark.line * scale}px`, letterSpacing: mark.tracking * scale }}>{mark.text}</div>
          <div style={{ ...faces.bodyMedium, fontSize: cardBand.size * scale, lineHeight: `${cardBand.line * scale}px`, letterSpacing: cardBand.tracking * scale, textTransform: "uppercase" }}>
            {`${exhibition.venue.city} · ${exhibition.startDate.slice(0, 4)}`}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1440, fonts },
  );
}
