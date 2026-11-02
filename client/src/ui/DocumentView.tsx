import type { ReactNode } from "react";
import { Image, View } from "react-native";
import type { ExpandedBlock, ExpandedDocument } from "@still/shared/document";
import { Text } from "./Text";

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
    <View style={{ gap: 12 }}>
      {document?.blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <Text key={i} variant="title">{block.text}</Text>;
          case "paragraph":
            return <Text key={i}>{block.text}</Text>;
          case "image":
            return (
              <Image
                key={i}
                source={{ uri: block.url }}
                accessibilityLabel={block.altText ?? undefined}
                style={{ width: "100%", aspectRatio: block.width / block.height }}
              />
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
