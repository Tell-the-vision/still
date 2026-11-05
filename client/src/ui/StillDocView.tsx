import type { ReactNode } from "react";
import { View } from "react-native";
import { Artwork } from "./Artwork";
import { Text } from "./Text";
import { colors, spacing } from "./theme";

// The STILL document served by the API (SPEC §11.8). Unknown nodes are skipped, unknown marks are plain text.
type Mark = { type: string; attrs?: { sentenceId?: string } };
type StillNode = { type: string; attrs?: Record<string, unknown>; content?: StillNode[]; text?: string; marks?: Mark[] };
export type StillDoc = { version: 1; type: "doc"; content: StillNode[] };
export type KeepableSentence = { sentenceId: string; text: string };
export type RenderSentence = (sentence: KeepableSentence, quote: ReactNode) => ReactNode;

export const isStillDoc = (document: unknown): document is StillDoc =>
  typeof document === "object" && document !== null && (document as { type?: unknown }).type === "doc";

type Run = { text: string; sentenceId?: string };

// Consecutive text sharing one scrap mark is one keepable sentence; everything else is plain text.
function runsOf(paragraph: StillNode): Run[] {
  const runs: Run[] = [];
  for (const node of paragraph.content ?? []) {
    if (node.type !== "text" || !node.text) continue;
    const sentenceId = node.marks?.find((m) => m.type === "scrap")?.attrs?.sentenceId;
    const last = runs[runs.length - 1];
    if (last && last.sentenceId === sentenceId) last.text += node.text;
    else runs.push({ text: node.text, sentenceId });
  }
  return runs;
}

const quoted = (text: string) => (/^["“]/.test(text) ? text : `“${text}”`);

function Paragraph({ node, renderSentence }: { node: StillNode; renderSentence?: RenderSentence }) {
  const runs = runsOf(node);
  if (runs.length === 0) return null;
  return (
    <View style={{ gap: spacing.tight }}>
      {runs.map((run, i) => {
        if (!run.sentenceId || !renderSentence) return <Text key={i}>{run.text}</Text>;
        const quote = <Text variant="quote">{quoted(run.text)}</Text>;
        return <View key={i}>{renderSentence({ sentenceId: run.sentenceId, text: run.text }, quote)}</View>;
      })}
    </View>
  );
}

function Block({ node, first, renderSentence }: { node: StillNode; first: boolean; renderSentence?: RenderSentence }) {
  const children = (node.content ?? []).map((child, i) => <Block key={i} node={child} first={false} renderSentence={renderSentence} />);
  switch (node.type) {
    case "heading":
      return (
        <Text accessibilityRole="header" variant="subhead" style={first ? undefined : { marginTop: spacing.section - spacing.tight }}>
          {(node.content ?? []).map((n) => n.text ?? "").join("")}
        </Text>
      );
    case "paragraph":
      return <Paragraph node={node} renderSentence={renderSentence} />;
    case "blockquote":
      return <View style={{ gap: spacing.gap, paddingLeft: spacing.inset, borderLeftWidth: 2, borderLeftColor: colors.gray }}>{children}</View>;
    case "bulletList":
    case "orderedList":
      return (
        <View accessibilityRole="list" style={{ gap: spacing.tight }}>
          {(node.content ?? []).map((item, i) => (
            <View key={i} accessibilityRole="listitem" style={{ flexDirection: "row", gap: spacing.tight }}>
              <Text aria-hidden>{node.type === "orderedList" ? `${i + 1}.` : "•"}</Text>
              <View style={{ flex: 1, gap: spacing.tight }}>
                {(item.content ?? []).map((p, j) => <Block key={j} node={p} first={false} renderSentence={renderSentence} />)}
              </View>
            </View>
          ))}
        </View>
      );
    case "stillImage": {
      const { url, altText, width, height, caption } = node.attrs ?? {};
      if (typeof url !== "string" || typeof width !== "number" || typeof height !== "number") return null;
      // Never cropped or upscaled (SPEC §0.3): Artwork contains the image within its natural size.
      return <Artwork url={url} altText={typeof altText === "string" ? altText : null} width={width} height={height} caption={typeof caption === "string" ? caption : undefined} maxHeight={height} />;
    }
    default:
      return null;
  }
}

export function StillDocView({ document, renderSentence }: { document: StillDoc; renderSentence?: RenderSentence }) {
  return (
    <View style={{ gap: spacing.gap }}>
      {document.content.map((node, i) => <Block key={i} node={node} first={i === 0} renderSentence={renderSentence} />)}
    </View>
  );
}
