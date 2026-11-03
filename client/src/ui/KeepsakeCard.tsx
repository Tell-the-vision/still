import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { develop as timing, nativeDriver, reduced as reducedTiming, routine, still, tray, useReduceMotion, type Develop } from "./motion";
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
// `entering` is the id of a sentence that was just added: only that line inks in.
// `develop` is the card's one authored moment, set where a save lands (features/keepsake/develop.ts):
// the sheet stays, the cover comes up like a print in the tray, then the title, the lines, the date.
// The card reports when it begins and when it is done; a card mounting after its surface's run began simply rests.
// `reinkOnLayout` (the editor) lets the lines ink in again when the layout changes.
// Motion only ever changes opacity (and, on web, the cover's brightness); the geometry is the PNG's.
export function KeepsakeCard({
  card,
  templateId,
  width = cardTokens.width,
  placeholder,
  entering,
  develop,
  reinkOnLayout,
  accessibilityLabel = "Web card",
}: {
  card: Card;
  templateId: string;
  width?: number;
  placeholder?: string;
  entering?: string;
  develop?: Develop;
  reinkOnLayout?: boolean;
  accessibilityLabel?: string;
}) {
  const { exhibition, image } = card;
  const personal =
    templateId === "sentence" ? card.sentences.map((s) => ({ id: s.sentenceId, text: s.content }))
    : templateId === "reflection" ? [card.sentences[0] && { id: card.sentences[0].sentenceId, text: card.sentences[0].content }, card.journalExcerpt && { id: "excerpt", text: card.journalExcerpt }].filter((t) => !!t)
    : [];
  const innerWidth = width - 2 * (cardTokens.borderWidth + spacing.gap);
  const reduce = useReduceMotion() === true;
  const [coverSettled, setCoverSettled] = useState(false);
  const print = usePrintDevelop(develop ?? resting, reduce, !image || coverSettled);
  useReink(print.lines, templateId, reinkOnLayout === true, reduce);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      {...(develop !== undefined && webData({ develop: print.display }))}
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
      <View style={{ gap: spacing.inset, flexShrink: 1, minHeight: 0, marginBottom: spacing.tight }}>
        <Wordmark size="card" />
        {image && <Cover image={image} innerWidth={innerWidth} print={print} onSettle={() => setCoverSettled(true)} />}
        <Animated.View style={{ opacity: print.title }}>
          <Text variant="title">{exhibition.title}</Text>
        </Animated.View>
        {personal.map(({ id, text }, i) => (
          <Line key={id} ink={print.line(i)} animate={id === entering} reduce={reduce}>
            <Text variant="secondary">{text}</Text>
          </Line>
        ))}
        {personal.length === 0 && placeholder && (
          <Animated.View style={{ opacity: print.line(0) }}>
            <Text variant="secondary">{placeholder}</Text>
          </Animated.View>
        )}
      </View>
      <Animated.View style={{ opacity: print.caption }}>
        <Text variant="caption">{`${exhibition.venue.city} / ${exhibition.startDate.slice(0, 4)}`}</Text>
      </Animated.View>
    </View>
  );
}

// `data-*` attributes exist on web only; tests read the develop phase from them.
const webData = (data: Record<string, string>) => (Platform.OS === "web" ? ({ dataSet: data } as object) : {});

type Print = ReturnType<typeof usePrintDevelop>;

const resting: Develop = { phase: "still", begun: false, onBegin: () => {}, onDone: () => {} };

// The develop's values: the cover's progress and one ink layer per text group, all at 1 at rest.
// Paper sets them to 0 before paint, never in the initial value, so a card that never runs is simply there.
function usePrintDevelop({ phase, begun, onBegin, onDone }: Develop, reduce: boolean, coverReady: boolean) {
  const [values] = useState(() => {
    const cover = new Animated.Value(1);
    return {
      cover,
      title: new Animated.Value(1),
      // Lines past the third share the third's timing: the stagger stops there.
      lines: Array.from({ length: timing.line.maxStagger + 1 }, () => new Animated.Value(1)),
      caption: new Animated.Value(1),
      // The veil lifts in the first quarter on web, where the brightness ramp carries the rest; on native it carries it all.
      veil: cover.interpolate({ inputRange: [0, 0.25], outputRange: [1, 0], extrapolate: "clamp" }),
      veilFull: cover.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      // A print in the developer: highlights held at paper white while the shadows come up first.
      brightness: cover.interpolate({ inputRange: [0, 1], outputRange: ["brightness(2.4)", "brightness(1)"] }),
    };
  });
  const all = [values.cover, values.title, ...values.lines, values.caption];

  // This card carries the develop from paper, or from mounting in view before the run began, until its
  // surface is still again. One that mounts after the run began (a remount, a swap) simply rests.
  const [carrying, setCarrying] = useState(false);
  const carry = phase === "paper" || (phase === "run" && (carrying || !begun));
  if (carry !== carrying) setCarrying(carry);

  // Carrying blanks the sheet before paint; back to still (done, or leaving mid-run) completes it within the frame.
  useLayoutEffect(() => {
    all.forEach((v) => {
      v.stopAnimation();
      v.setValue(carrying ? 0 : 1);
    });
  }, [carrying]); // `all` holds the same values every render.

  const running = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (phase !== "run" || begun || !carrying || running.current) return;
    const begin = () => {
      const ink = (value: Animated.Value, delay: number, duration: number, easing = still) =>
        Animated.timing(value, {
          toValue: 1,
          delay: reduce ? 0 : delay,
          duration: reduce ? reducedTiming.develop : duration,
          easing,
          useNativeDriver: nativeDriver,
        });
      const run = Animated.parallel([
        ink(values.cover, timing.cover.delay, timing.cover.duration, tray),
        ink(values.title, timing.title.delay, timing.title.duration),
        ...values.lines.map((v, i) => ink(v, timing.line.delay + i * timing.line.stagger, timing.line.duration)),
        ink(values.caption, timing.caption.delay, timing.caption.duration),
      ]);
      running.current = run;
      onBegin();
      run.start(({ finished }) => {
        running.current = null;
        if (finished) onDone();
      });
    };
    // Develop the cover, not its empty box: wait briefly for the image, then go anyway.
    if (coverReady) return begin();
    const wait = setTimeout(begin, timing.coverWait);
    return () => clearTimeout(wait);
  }, [phase, begun, carrying, coverReady, reduce, values, onBegin, onDone]);
  useEffect(() => () => running.current?.stop(), []);

  // Only while this card is developing: at rest the cover carries no veil and no filter.
  return {
    display: carrying ? phase : "still",
    title: values.title,
    lines: values.lines,
    line: (i: number) => values.lines[Math.min(i, timing.line.maxStagger)],
    caption: values.caption,
    veil: carrying ? (Platform.OS === "web" && !reduce ? values.veil : values.veilFull) : null,
    filter: carrying && Platform.OS === "web" && !reduce ? values.brightness : null,
  };
}

// The editor: a new layout lays its lines down again, quickly. Nothing else on the card moves.
function useReink(lines: Animated.Value[], templateId: string, enabled: boolean, reduce: boolean) {
  const seen = useRef(templateId);
  useLayoutEffect(() => {
    if (seen.current === templateId) return;
    seen.current = templateId;
    if (!enabled) return;
    lines.forEach((v) => {
      v.stopAnimation();
      v.setValue(0);
    });
    Animated.parallel(
      lines.map((v) => Animated.timing(v, { toValue: 1, duration: reduce ? reducedTiming.reink : routine.reink, easing: still, useNativeDriver: nativeDriver })),
    ).start();
  }, [lines, templateId, enabled, reduce]);
}

// The cover at full width in its own shape; it shrinks, never crops, when the text needs the room.
// If it fails to load it disappears and the text continues (SPEC §3.4).
// The filter sits on a wrapper: react-native-web's Image reads `filter` once and wouldn't follow the animation.
function Cover({ image, innerWidth, print, onSettle }: { image: NonNullable<Card["image"]>; innerWidth: number; print: Print; onSettle: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ height: coverHeight(innerWidth, image), flexShrink: 1, minHeight: 0 }}>
      <Animated.View style={[StyleSheet.absoluteFill, print.filter && ({ filter: print.filter } as object)]}>
        <Image
          source={{ uri: image.url }}
          alt={image.altText ?? undefined}
          accessibilityLabel={image.altText ?? undefined}
          accessibilityRole="image"
          aria-hidden={!image.altText}
          onLoad={onSettle}
          onError={() => {
            setFailed(true);
            onSettle();
          }}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>
      {print.veil && <Animated.View aria-hidden pointerEvents="none" {...webData({ developVeil: "" })} style={[veilBox, { opacity: print.veil }]} />}
    </View>
  );
}

// A pixel past the cover on every side, so no edge of the image shows through at a fractional scale.
const veilBox = { position: "absolute", top: -1, left: -1, right: -1, bottom: -1, backgroundColor: colors.white } as const;

// A line inks in where it stands when it was just added: opacity only, 240ms, nothing slides.
// Its own value starts at 0 so it never flashes; the card's ink layer (develop, reink) multiplies in.
function Line({ ink, animate, reduce, children }: { ink: Animated.Value; animate: boolean; reduce: boolean; children: ReactNode }) {
  const [own] = useState(() => new Animated.Value(animate ? 0 : 1));
  const opacity = useMemo(() => Animated.multiply(ink, own), [ink, own]);
  const entering = useRef(animate);
  useEffect(() => {
    if (!entering.current) return;
    entering.current = false;
    Animated.timing(own, { toValue: 1, duration: reduce ? reducedTiming.lineIn : routine.lineIn, easing: still, useNativeDriver: nativeDriver }).start();
  }, []); // Only on mount: a line that was already there never inks again.
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
