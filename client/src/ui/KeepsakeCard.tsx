import { View } from "react-native";
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

// The shareable web card (SPEC §7.1): black on white, plain text only.
// `sentence` shows the sentences, `reflection` the first sentence and the excerpt, `cover` neither.
export function KeepsakeCard({ card, templateId, width = cardTokens.width }: { card: Card; templateId: string; width?: number }) {
  const { exhibition, image } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => s.content)
    : templateId === "reflection" ? [card.sentences[0]?.content, card.journalExcerpt].filter((t): t is string => !!t)
    : [];
  return (
    <View
      accessibilityLabel="Web card"
      style={{
        width,
        aspectRatio: cardTokens.aspectRatio,
        padding: spacing.gap,
        justifyContent: "space-between",
        overflow: "hidden",
        backgroundColor: colors.white,
        borderColor: colors.black,
        borderWidth: cardTokens.borderWidth,
      }}
    >
      <View style={{ gap: spacing.inset }}>
        <Wordmark size="card" />
        {image && <Artwork {...image} />}
        <Text variant="title">{exhibition.title}</Text>
        {personal.map((text) => (
          <Text key={text} variant="secondary">{text}</Text>
        ))}
      </View>
      <Text variant="caption">{`${exhibition.venue.city} / ${exhibition.startDate.slice(0, 4)}`}</Text>
    </View>
  );
}
