import { useState } from "react";
import { Image, View } from "react-native";
import { Text } from "./Text";
import { spacing } from "./theme";

type Props = { url: string; altText: string | null; width: number; height: number; caption?: string };

// An exhibition image with an optional caption. If it fails to load, image and caption
// disappear and the text continues (SPEC §3.4).
export function Artwork({ url, altText, width, height, caption }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ gap: spacing.tight }}>
      <Image
        source={{ uri: url }}
        alt={altText ?? undefined}
        accessibilityLabel={altText ?? undefined}
        accessibilityRole="image"
        aria-hidden={!altText}
        onError={() => setFailed(true)}
        style={{ width: "100%", aspectRatio: width / height }}
      />
      {caption ? <Text variant="caption">{caption}</Text> : null}
    </View>
  );
}
