import { useState } from "react";
import { Image, View } from "react-native";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";
import { card as cardTokens, colors, coverHeight, spacing } from "./theme";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  image: { url: string; altText: string | null; width: number; height: number } | null;
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
};

// The shareable web card (SPEC §7.1): black on white, plain text only.
// `sentence` shows the sentences, `reflection` the first sentence and the excerpt, `cover` neither.
// src/server/media/keepsake-png.tsx draws the same layout for the PNG; change both together.
export function KeepsakeCard({ card, templateId, width = cardTokens.width }: { card: Card; templateId: string; width?: number }) {
  const { exhibition, image } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => s.content)
    : templateId === "reflection" ? [card.sentences[0]?.content, card.journalExcerpt].filter((t): t is string => !!t)
    : [];
  const innerWidth = width - 2 * (cardTokens.borderWidth + spacing.gap);
  return (
    <View
      accessibilityLabel="Web card"
      style={{
        width,
        // A fixed height, not aspectRatio: long text shrinks the cover instead of stretching the sheet.
        height: width / cardTokens.aspectRatio,
        padding: spacing.gap,
        justifyContent: "space-between",
        overflow: "hidden",
        backgroundColor: colors.white,
        borderColor: colors.black,
        borderWidth: cardTokens.borderWidth,
      }}
    >
      <View style={{ gap: spacing.inset, flexShrink: 1, minHeight: 0 }}>
        <Wordmark size="card" />
        {image && <Cover image={image} innerWidth={innerWidth} />}
        <Text variant="title">{exhibition.title}</Text>
        {personal.map((text) => (
          <Text key={text} variant="secondary">{text}</Text>
        ))}
      </View>
      <Text variant="caption">{`${exhibition.venue.city} / ${exhibition.startDate.slice(0, 4)}`}</Text>
    </View>
  );
}

// The cover at full width in its own shape; it shrinks, never crops, when the text needs the room.
// If it fails to load it disappears and the text continues (SPEC §3.4).
function Cover({ image, innerWidth }: { image: NonNullable<Card["image"]>; innerWidth: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ height: coverHeight(innerWidth, image), flexShrink: 1, minHeight: 0 }}>
      <Image
        source={{ uri: image.url }}
        alt={image.altText ?? undefined}
        accessibilityLabel={image.altText ?? undefined}
        accessibilityRole="image"
        aria-hidden={!image.altText}
        onError={() => setFailed(true)}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
