import type { ReactNode } from "react";
import { Image, View } from "react-native";
import { Artwork } from "./Artwork";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";
import { card as cardTokens, colors, spacing } from "./theme";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  image: { url: string; altText: string | null; width: number; height: number } | null;
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
};

// Visual styles for the creator preview only. They are not saved, and the PNG keeps `plain`.
export const KEEPSAKE_STYLES = ["plain", "overlay", "frame", "quote"] as const;
export type KeepsakeStyle = (typeof KEEPSAKE_STYLES)[number];

type Props = { card: Card; templateId: string; width?: number; style?: KeepsakeStyle };

// The shareable web card (SPEC §7.1): black on white, plain text only.
// `sentence` shows the sentences, `reflection` the first sentence and the excerpt, `cover` neither.
export function KeepsakeCard({ card, templateId, width = cardTokens.width, style = "plain" }: Props) {
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => s.content)
    : templateId === "reflection" ? [card.sentences[0]?.content, card.journalExcerpt].filter((t): t is string => !!t)
    : [];
  const caption = `${card.exhibition.venue.city} / ${card.exhibition.startDate.slice(0, 4)}`;
  const Layout = layouts[style];
  return (
    <View
      accessibilityLabel="Web card"
      testID={`keepsake-card-${style}`}
      style={{
        width,
        // A fixed height, not aspectRatio: long content must never stretch the sheet.
        height: width / cardTokens.aspectRatio,
        overflow: "hidden",
        backgroundColor: colors.white,
        borderColor: colors.black,
        borderWidth: cardTokens.borderWidth,
      }}
    >
      <Layout card={card} personal={personal} caption={caption} />
    </View>
  );
}

type LayoutProps = { card: Card; personal: string[]; caption: string };

const white = { color: colors.white };

// The saved card: wordmark, cover, title, personal record, caption.
function Plain({ card, personal, caption }: LayoutProps) {
  return (
    <Fill padding gap>
      <Wordmark size="card" />
      {card.image && <Artwork {...card.image} />}
      <Text variant="title">{card.exhibition.title}</Text>
      {personal.map((text) => (
        <Text key={text} variant="secondary">{text}</Text>
      ))}
      <Text variant="caption">{caption}</Text>
    </Fill>
  );
}

// The whole cover, never cropped, over a blurred fill of itself, under a light veil; the text sits on it in white.
function Overlay({ card, personal, caption }: LayoutProps) {
  const cover = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {card.image && (
        <>
          <Image source={{ uri: card.image.url }} resizeMode="cover" blurRadius={24} aria-hidden style={cover} />
          <Image source={{ uri: card.image.url }} accessibilityLabel={card.image.altText ?? undefined} resizeMode="contain" style={cover} />
        </>
      )}
      <View style={{ flex: 1, padding: spacing.gap, justifyContent: "space-between", backgroundColor: "rgba(0, 0, 0, 0.35)" }}>
        <Text variant="caption" style={white}>STILL</Text>
        <View style={{ gap: spacing.inset }}>
          {personal.map((text) => (
            <Text key={text} variant="action" numberOfLines={5} style={white}>{text}</Text>
          ))}
          <View style={{ height: 1, backgroundColor: colors.white }} />
          <Text variant="title" style={white}>{card.exhibition.title}</Text>
          <Text variant="caption" style={white}>{caption}</Text>
        </View>
      </View>
    </View>
  );
}

// A gallery mat: the whole cover inside a thin frame, a centred caption below.
// The frame takes the cover's shape at a fixed share of the card's height, so the text below always fits.
function Frame({ card, personal, caption }: LayoutProps) {
  const [first] = personal;
  return (
    <Fill padding gap center>
      {card.image && (
        <View style={{ height: "55%", aspectRatio: card.image.width / card.image.height, maxWidth: "100%", padding: spacing.tight, borderWidth: 1, borderColor: colors.black }}>
          <Image source={{ uri: card.image.url }} accessibilityLabel={card.image.altText ?? undefined} resizeMode="contain" style={{ flex: 1 }} />
        </View>
      )}
      <Text variant="subhead" style={{ textAlign: "center" }}>{card.exhibition.title}</Text>
      {first && <Text variant="secondary" numberOfLines={3} style={{ textAlign: "center" }}>{`“${first}”`}</Text>}
      <Text variant="caption" style={{ textAlign: "center" }}>{caption}</Text>
      <Wordmark size="card" />
    </Fill>
  );
}

// The words lead; the cover shrinks to a thumbnail beside the title.
function Quote({ card, personal, caption }: LayoutProps) {
  return (
    <Fill padding justify="space-between">
      <Wordmark size="card" />
      {personal.length > 0 && (
        <View style={{ gap: spacing.inset }}>
          <Text variant="headline">“</Text>
          {personal.map((text) => (
            <Text key={text} variant={quoteSize(personal)} numberOfLines={10}>{text}</Text>
          ))}
          <Text variant="headline" style={{ textAlign: "right" }}>”</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: spacing.inset, alignItems: "center", borderTopWidth: 1, borderColor: colors.black, paddingTop: spacing.inset }}>
        {card.image && <Image source={{ uri: card.image.url }} accessibilityLabel={card.image.altText ?? undefined} resizeMode="cover" style={{ width: 44, height: 44 }} />}
        <View style={{ flex: 1 }}>
          <Text variant="action">{card.exhibition.title}</Text>
          <Text variant="caption">{caption}</Text>
        </View>
      </View>
    </Fill>
  );
}

// The quoted words are as large as their length allows: a short sentence reads big, a long record stays whole.
const quoteSize = (texts: string[]) => {
  const length = texts.join("").length;
  return length <= 60 ? "subhead" : length <= 140 ? "row" : "action";
};

const layouts: Record<KeepsakeStyle, (props: LayoutProps) => ReactNode> = { plain: Plain, overlay: Overlay, frame: Frame, quote: Quote };

// The card's inner column.
function Fill({ children, padding, gap, center, justify }: { children: ReactNode; padding?: boolean; gap?: boolean; center?: boolean; justify?: "space-between" }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        padding: padding ? spacing.gap : 0,
        gap: gap ? spacing.inset : 0,
        alignItems: center ? "center" : undefined,
        justifyContent: center ? "center" : justify,
      }}
    >
      {children}
    </View>
  );
}
