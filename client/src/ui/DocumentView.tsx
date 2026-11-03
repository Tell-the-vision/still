import type { ReactNode } from "react";
import { View } from "react-native";
import type { ExpandedBlock, ExpandedDocument } from "@still/shared/document";
import { Artwork } from "./Artwork";
import { Text } from "./Text";
import { spacing } from "./theme";

type SentenceBlock = Extract<ExpandedBlock, { type: "sentence" }>;

const quoted = (text: string) => (/^["“]/.test(text) ? text : `“${text}”`);

// Renders a served document (SPEC §9). Text is plain, never HTML.
export function DocumentView({
  document,
  renderSentence,
}: {
  document: ExpandedDocument | null;
  renderSentence?: (block: SentenceBlock, quote: ReactNode) => ReactNode;
}) {
  return (
    <View style={{ gap: spacing.gap }}>
      {document?.blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <Text key={i} variant="subhead" style={i > 0 ? { marginTop: spacing.section - spacing.tight } : undefined}>{block.text}</Text>;
          case "paragraph":
            return <Text key={i}>{block.text}</Text>;
          case "image":
            return (
              <Artwork key={i} url={block.url} altText={block.altText} width={block.width} height={block.height} />
            );
          case "sentence": {
            const quote = <Text variant="quote">{quoted(block.text)}</Text>;
            return <View key={i}>{renderSentence ? renderSentence(block, quote) : quote}</View>;
          }
          default:
            return null;
        }
      })}
    </View>
  );
}
