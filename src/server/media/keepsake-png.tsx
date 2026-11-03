import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { card as cardTheme, colors, fontSize, spacing } from "../../../client/src/ui/tokens";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
  image: { url: string } | null;
};

// SPEC §7.1: the cover is part of the PNG when it can be fetched; any failure means the no-image layout.
async function fetchCover(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
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
  { name: "Noto Sans KR", data: loadFont("noto-sans-kr", "400Regular/NotoSansKR_400Regular.ttf"), weight: 400 as const },
];

// Hangul falls through the stack to Noto Sans KR, as on the web card.
const display = "Montserrat, Noto Sans KR";
const body = "DM Sans, Noto Sans KR";

export async function renderKeepsakePng(card: Card, templateId: string) {
  const { exhibition } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => s.content)
    : templateId === "reflection" ? [card.sentences[0]?.content, card.journalExcerpt].filter((t): t is string => !!t)
    : [];
  const cover = card.image && (await fetchCover(card.image.url));
  const secondary = { fontFamily: body, fontSize: fontSize.small * scale, color: colors.gray };
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: spacing.gap * scale, gap: spacing.inset * scale, background: colors.white, color: colors.black, border: `${cardTheme.borderWidth * scale}px solid ${colors.black}` }}>
        <div style={{ fontFamily: display, fontSize: fontSize.body * scale }}>STILL</div>
        <div style={{ fontFamily: display, fontSize: fontSize.title * scale }}>{exhibition.title}</div>
        <div style={secondary}>{`${exhibition.venue.name} · ${exhibition.venue.city}`}</div>
        <div style={secondary}>{`${exhibition.startDate} – ${exhibition.endDate}`}</div>
        {cover && (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* satori renders a plain img; next/image does not apply */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
        {personal.map((text) => (
          <div key={text} style={{ fontFamily: body, fontSize: fontSize.body * scale }}>{text}</div>
        ))}
      </div>
    ),
    { width: 1080, height: 1440, fonts },
  );
}
