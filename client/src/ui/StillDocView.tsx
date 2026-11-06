import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Artwork } from "./Artwork";
import { Text } from "./Text";
import { colors, spacing } from "./theme";

// The STILL document served by the API (SPEC §11.8). Unknown nodes are skipped, unknown marks are plain text.
type Mark = { type: string; attrs?: { sentenceId?: string } };
type StillNode = { type: string; attrs?: Record<string, unknown>; content?: StillNode[]; text?: string; marks?: Mark[] };
export type StillDoc = { version: 1; type: "doc"; content: StillNode[] };
export type KeepableSentence = { sentenceId: string; text: string };
export type RenderSentence = (sentence: KeepableSentence, quote: ReactNode) => ReactNode;
// A playlist block: its link and title (possibly empty). The screen decides how it is drawn.
export type PagePlaylist = { url: string; title: string };
export type RenderPlaylist = (playlist: PagePlaylist) => ReactNode;

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

// About 65 characters of body text per line; images may run wider than this.
const MEASURE = 520;
// A gallery slide shows a part of the next one, so it reads as swipeable.
const SLIDE_WIDTH = 260;

const quoted = (text: string) => (/^["“]/.test(text) ? text : `“${text}”`);

function Paragraph({ node, renderSentence }: { node: StillNode; renderSentence?: RenderSentence }) {
  const runs = runsOf(node);
  if (runs.length === 0) return null;
  return (
    <View style={{ gap: spacing.tight }}>
      {runs.map((run, i) => {
        if (!run.sentenceId || !renderSentence) return <Text key={i} style={{ maxWidth: MEASURE }}>{run.text}</Text>;
        const quote = <Text variant="quote" style={{ maxWidth: MEASURE, textDecorationLine: "underline", textDecorationColor: colors.gray }}>{quoted(run.text)}</Text>;
        return <View key={i}>{renderSentence({ sentenceId: run.sentenceId, text: run.text }, quote)}</View>;
      })}
    </View>
  );
}

// Headings as the editor draws them (tokens.ts docTitle…docH3): the size comes from the level, and an item's first
// level-2 heading is its title. A level 1 is a guide section title, which only a whole guide has.
const HEADING_VARIANTS = { 1: "docH1", 2: "docH2", 3: "docH3" } as const;

function Heading({ node, first, title }: { node: StillNode; first: boolean; title: boolean }) {
  const level = node.attrs?.level === 1 || node.attrs?.level === 3 ? node.attrs.level : 2;
  const isTitle = title && level === 2;
  return (
    <Text
      accessibilityRole="header"
      aria-level={isTitle ? 1 : level + 1}
      variant={isTitle ? "docTitle" : HEADING_VARIANTS[level]}
      style={[isTitle && { letterSpacing: -0.36 }, !first && { marginTop: spacing.section - spacing.tight }]}
    >
      {(node.content ?? []).map((n) => n.text ?? "").join("")}
    </Text>
  );
}

function Block({ node, first, renderSentence, title = false }: { node: StillNode; first: boolean; renderSentence?: RenderSentence; title?: boolean }) {
  const children = (node.content ?? []).map((child, i) => <Block key={i} node={child} first={false} renderSentence={renderSentence} />);
  switch (node.type) {
    case "heading":
      return <Heading node={node} first={first} title={title} />;
    case "paragraph":
      return <Paragraph node={node} renderSentence={renderSentence} />;
    case "blockquote":
      return <View style={{ gap: spacing.gap, paddingLeft: spacing.inset, borderLeftWidth: 1, borderLeftColor: colors.gray }}>{children}</View>;
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
      const artwork = <Artwork url={url} altText={typeof altText === "string" ? altText : null} width={width} height={height} caption={typeof caption === "string" ? caption : undefined} maxHeight={height} />;
      // HERO runs edge to edge (past the screen's gutter); PORTRAIT is narrower and centred; INLINE and a lone GALLERY stay in the column.
      if (node.attrs?.display === "HERO") return <View style={{ marginHorizontal: -spacing.gutter }}>{artwork}</View>;
      if (node.attrs?.display === "PORTRAIT") return <View style={{ width: "70%", alignSelf: "center" }}>{artwork}</View>;
      return artwork;
    }
    default:
      return null;
  }
}

const isGallery = (node: StillNode) => node.type === "stillImage" && node.attrs?.display === "GALLERY";

// Consecutive GALLERY images become one group: a horizontal row that snaps slide by slide.
function Gallery({ nodes, renderSentence }: { nodes: StillNode[]; renderSentence?: RenderSentence }) {
  return (
    <ScrollView
      horizontal
      testID="gallery-row"
      showsHorizontalScrollIndicator={false}
      snapToInterval={SLIDE_WIDTH + spacing.gap}
      decelerationRate="fast"
      style={{ marginHorizontal: -spacing.gutter }}
      contentContainerStyle={{ gap: spacing.gap, paddingHorizontal: spacing.gutter }}
    >
      {nodes.map((node, i) => (
        <View key={i} style={{ width: SLIDE_WIDTH }}>
          <Block node={node} first={false} renderSentence={renderSentence} />
        </View>
      ))}
    </ScrollView>
  );
}

/** `item`: the document is one item standing on its own (a page), so a heading it opens with is its title, as in the editor. */
export function StillDocView({ document, renderSentence, renderPlaylist, item = false }: { document: StillDoc; renderSentence?: RenderSentence; renderPlaylist?: RenderPlaylist; item?: boolean }) {
  return (
    // Text keeps the reading measure; an image is centred in the full column (still never past its own pixels).
    <View style={{ gap: spacing.gap }}>
      {document.content.map((node, i) => {
        if (node.type === "playlist") return <View key={i}>{renderPlaylist?.({ url: String(node.attrs?.url ?? ""), title: String(node.attrs?.title ?? "") })}</View>;
        if (node.type === "stillImage" && !isGallery(node)) return <Block key={i} node={node} first={i === 0} renderSentence={renderSentence} />;
        // A paragraph spans the column so a kept line's mark lines up with the column's right edge (the listen row's
        // arrow, the picture's edge); its text keeps the reading measure itself (Paragraph).
        const measure = node.type === "paragraph" ? undefined : { maxWidth: MEASURE };
        if (!isGallery(node)) return <View key={i} style={measure}><Block node={node} first={i === 0} renderSentence={renderSentence} title={item && i === 0} /></View>;
        if (i > 0 && isGallery(document.content[i - 1])) return null; // already in the row above
        const row = [node];
        for (let j = i + 1; j < document.content.length && isGallery(document.content[j]); j++) row.push(document.content[j]);
        return <Gallery key={i} nodes={row} renderSentence={renderSentence} />;
      })}
    </View>
  );
}
