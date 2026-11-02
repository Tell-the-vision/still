import { useState } from "react";
import { Image } from "react-native";

type Props = { url: string; altText: string | null; width: number; height: number };

// An exhibition image. If it fails to load it disappears and the text continues (SPEC §3.4).
export function Artwork({ url, altText, width, height }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={altText ?? ""}
      onError={() => setFailed(true)}
      style={{ width: "100%", aspectRatio: width / height }}
    />
  );
}
