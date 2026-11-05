import { cardBlocks } from "@still/shared/keepsake";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { develop as timing, nativeDriver, reduced as reducedTiming, routine, still, tray, useReduceMotion, type Develop } from "./motion";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";
import { card as cardTokens, cardBand, cardText, colors, coverHeight, fontFamily, spacing } from "./theme";

type Card = {
  exhibition: { title: string; venue: { name: string; city: string }; startDate: string; endDate: string };
  image: { url: string; altText: string | null; width: number; height: number } | null;
  sentences: { sentenceId: string; content: string }[];
  journalExcerpt: string | null;
};

// The shareable web card (SPEC §7.1): black on white, plain text only, in the design the template names
// (cardBlocks), above a black band with the wordmark and "CITY · YEAR". src/server/media/keepsake-png.tsx draws the
// same blocks for the PNG; change both together.
// `placeholder` shows in gray while the card has no personal lines (the preview only).
// `entering` is the id of a line that was just added: only that line inks in.
// `develop` is the card's one authored moment, set where a save lands (features/keepsake/develop.ts): the sheet
// stays, the picture comes up like a print in the tray, then the title, the words one after another, the band last.
// The card reports when it begins and when it is done; a card mounting after its surface's run began simply rests.
// `reinkOnLayout` (the card maker) lets the words ink in again when the design changes.
// Motion only ever changes opacity (and, on web, the picture's brightness); the geometry is the PNG's.
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
  const blocks = cardBlocks({ title: exhibition.title, image, sentences: card.sentences, journalExcerpt: card.journalExcerpt }, templateId, placeholder);
  const reduce = useReduceMotion() === true;
  const [coverSettled, setCoverSettled] = useState(false);
  const print = usePrintDevelop(develop ?? resting, reduce, !image || coverSettled);
  useReink(print.lines, templateId, reinkOnLayout === true, reduce);
  // Drawn at the theme's 360 and scaled, so every size shows the same words in the same places.
  const scale = width / cardTokens.width;
  const sheet = cardTokens.width - 2 * cardTokens.borderWidth;
  // The words ink in one after another, the title with its own layer.
  let words = 0;
  return (
    <View accessibilityLabel={accessibilityLabel} {...(develop !== undefined && webData({ develop: print.display }))} style={{ width, height: width / cardTokens.aspectRatio, overflow: "hidden" }}>
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
              return <Cover key={`picture-${i}`} image={image} width={block.full ? sheet : sheet - 2 * cardTokens.padding} full={block.full} first={block.first} print={print} onSettle={() => setCoverSettled(true)} />;
            }
            const { variant, gray, rule } = cardText[block.role];
            const body = (
              <View style={rule ? { borderTopWidth: 1, borderTopColor: colors.black, paddingTop: spacing.tight } : undefined}>
                <Text variant={variant} tone={gray ? "secondary" : "primary"}>{block.text}</Text>
              </View>
            );
            if (block.role === "title" || block.role === "titleSmall") return <Animated.View key={block.id} style={{ opacity: print.title }}>{body}</Animated.View>;
            return <Line key={block.id} ink={print.line(words++)} animate={block.id === entering} reduce={reduce}>{body}</Line>;
          })}
        </View>
        {/* The band: the wordmark, and where and when, white on black. It inks in last. */}
        <Animated.View style={{ opacity: print.caption, height: cardTokens.band, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: cardTokens.padding, backgroundColor: colors.black }}>
          <Wordmark size="card" color={colors.white} />
          <Text style={{ fontFamily: fontFamily.bodyMedium, fontSize: cardBand.size, lineHeight: cardBand.line, letterSpacing: cardBand.tracking, textTransform: "uppercase", color: colors.white }}>
            {`${exhibition.venue.city} · ${exhibition.startDate.slice(0, 4)}`}
          </Text>
        </Animated.View>
      </View>
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

// The picture at its width in its own shape: inside the margins, or edge to edge (`full`, and from the top edge when
// it comes `first`) on a plate of the light gray kept for image margins (SPEC §0.3). It shrinks, never crops, when the
// text needs the room. If it fails to load it disappears and the text continues (SPEC §3.4).
// The filter sits on a wrapper: react-native-web's Image reads `filter` once and wouldn't follow the animation.
function Cover({ image, width, full, first, print, onSettle }: { image: NonNullable<Card["image"]>; width: number; full: boolean; first: boolean; print: Print; onSettle: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ height: coverHeight(width, image), flexShrink: 1, minHeight: 0, marginHorizontal: full ? -cardTokens.padding : 0, marginTop: full && first ? -cardTokens.padding : 0, backgroundColor: full ? colors.placeholder : undefined }}>
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
