import { cardBlocks } from "@still/shared/keepsake";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Image, View } from "react-native";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";
import { card as cardTokens, cardBand, cardText, colors, coverHeight, fontFamily, spacing } from "./theme";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  image: { url: string; altText: string | null; width: number; height: number } | null;
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
};

// The shareable web card (SPEC §7.1): black on white, plain text only, in the layout and picture placement the
// template names (cardBlocks), above a black band with the wordmark and "CITY · YEAR". src/server/media/keepsake-png.tsx
// draws the same blocks for the PNG; change both together.
// `placeholder` shows in gray while the card has no personal lines (the preview only).
// `entering` is the id of a line that was just added: it fades in, the page's one authored motion.
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
  const blocks = cardBlocks({ title: exhibition.title, image, sentences: card.sentences, journalExcerpt: card.journalExcerpt }, templateId, placeholder);
  // Drawn at the theme's 360 and scaled, so every size shows the same words in the same places.
  const scale = width / cardTokens.width;
  const sheet = cardTokens.width - 2 * cardTokens.borderWidth;
  return (
    <View accessibilityLabel={accessibilityLabel} style={{ width, height: width / cardTokens.aspectRatio, overflow: "hidden" }}>
      <View
        style={{
          width: cardTokens.width,
          // A fixed height, not aspectRatio: long text shrinks the picture instead of stretching the sheet.
          height: cardTokens.width / cardTokens.aspectRatio,
          overflow: "hidden",
          backgroundColor: colors.white,
          borderColor: colors.black,
          borderWidth: cardTokens.borderWidth,
          transform: [{ scale }],
          transformOrigin: "top left",
        }}
      >
        <View style={{ flex: 1, minHeight: 0, padding: cardTokens.padding, gap: spacing.inset + 2, overflow: "hidden" }}>
          {blocks.map((block, i) => {
            if (block.kind === "picture") {
              if (!image) return null;
              return <Cover key={`picture-${i}`} image={image} width={block.full ? sheet : sheet - 2 * cardTokens.padding} full={block.full} first={block.first} />;
            }
            const { variant, gray, rule } = cardText[block.role];
            return (
              <Line key={block.id} animate={block.id === entering}>
                <View style={rule ? { borderTopWidth: 1, borderTopColor: colors.black, paddingTop: spacing.tight } : undefined}>
                  <Text variant={variant} tone={gray ? "secondary" : "primary"}>{block.text}</Text>
                </View>
              </Line>
            );
          })}
        </View>
        {/* The band: the wordmark, and where and when, white on black. */}
        <View style={{ height: cardTokens.band, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: cardTokens.padding, backgroundColor: colors.black }}>
          <Wordmark size="card" color={colors.white} />
          <Text style={{ fontFamily: fontFamily.bodyMedium, fontSize: cardBand.size, lineHeight: cardBand.line, letterSpacing: cardBand.tracking, textTransform: "uppercase", color: colors.white }}>
            {`${exhibition.venue.city} · ${exhibition.startDate.slice(0, 4)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// The picture at its width in its own shape: inside the margins, or edge to edge (`full`, and from the top edge when
// it comes `first`). It shrinks, never crops, when the text needs the room. If it fails to load it disappears and the
// text continues (SPEC §3.4).
function Cover({ image, width, full, first }: { image: NonNullable<Card["image"]>; width: number; full: boolean; first: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Edge to edge, the picture sits on a full-width plate of the light gray kept for image margins (SPEC §0.3), so a
    // tall picture that cannot fill the width still reads as running to the edges.
    <View style={{ height: coverHeight(width, image), flexShrink: 1, minHeight: 0, marginHorizontal: full ? -cardTokens.padding : 0, marginTop: full && first ? -cardTokens.padding : 0, backgroundColor: full ? colors.placeholder : undefined }}>
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
