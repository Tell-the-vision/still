import type { ReactNode } from "react";
import { View } from "react-native";
import type { ExpandedBlock, ExpandedDocument } from "@still/shared/document";
import { Artwork } from "./Artwork";
import { Text } from "./Text";
import { spacing } from "./theme";

type SentenceBlock = Extract<ExpandedBlock, { type: "sentence" }>;

// Renders a served document (SPEC §9). Text is plain, never HTML.
export function DocumentView({
  document,
  renderSentence,
}: {
  document: ExpandedDocument | null;
  renderSentence?: (block: SentenceBlock) => ReactNode;
}) {
  return (
    <View style={{ gap: spacing.inset }}>
      {document?.blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <Text key={i} variant="title">{block.text}</Text>;
          case "paragraph":
            return <Text key={i}>{block.text}</Text>;
          case "image":
            return (
              <Artwork key={i} url={block.url} altText={block.altText} width={block.width} height={block.height} />
            );
          case "sentence":
            return (
              <View key={i}>
                <Text>{block.text}</Text>
                {renderSentence?.(block)}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
