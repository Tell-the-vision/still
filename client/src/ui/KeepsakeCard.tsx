import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Image, View } from "react-native";
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
// `placeholder` shows in gray while the card has no personal lines (the preview only).
// `entering` is the id of a sentence that was just added: it fades in, the page's one authored motion.
export function KeepsakeCard({
  card,
  templateId,
  width = cardTokens.width,
  placeholder,
  entering,
  accessibilityLabel = "Web card",
}: {
  card: Card;
  templateId: string;
  width?: number;
  placeholder?: string;
  entering?: string;
  accessibilityLabel?: string;
}) {
  const { exhibition, image } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => ({ id: s.sentenceId, text: s.content }))
    : templateId === "reflection" ? [card.sentences[0] && { id: card.sentences[0].sentenceId, text: card.sentences[0].content }, card.journalExcerpt && { id: "excerpt", text: card.journalExcerpt }].filter((t) => !!t)
    : [];
  const innerWidth = width - 2 * (cardTokens.borderWidth + spacing.gap);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
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
        {personal.map(({ id, text }) => (
          <Line key={id} animate={id === entering}>
            <Text variant="secondary">{text}</Text>
          </Line>
        ))}
        {personal.length === 0 && placeholder && <Text variant="secondary">{placeholder}</Text>}
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

// A line that rises 8px into place over 240ms with exponential ease-out; reduced motion shows it at once.
function Line({ animate, children }: { animate: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return progress.setValue(1);
      Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    });
  }, [animate, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
