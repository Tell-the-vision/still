import { track } from "../../lib/analytics";
import { usePathname, useRouter } from "expo-router";
import { View } from "react-native";
import { keptDate } from "../../lib/dates";
import { Button } from "../../ui/Button";
import { InkStatus } from "../../ui/InkStatus";
import { KeepsakeThumb, THUMB_SCALE, thumbHeight } from "../../ui/KeepsakeThumb";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { colors, spacing } from "../../ui/theme";
import { useWide } from "../../ui/useWide";
import { keepsakeStrings as strings } from "./strings";
import { useDevelop } from "./develop";
import { useGuideKeepsake, type KeepsakePage } from "./useGuideKeepsake";

type Props = { code: string; exhibition: Parameters<typeof useGuideKeepsake>[1]; hasGuide: boolean; page: KeepsakePage };

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The keepsake panel on an artwork's page: that page's card as a thumbnail, where it stands, and the one next step.
export function KeepsakePresence({ code, exhibition, hasGuide, page }: Props) {
  const router = useRouter();
  // Signing in comes back to the page the panel is on.
  const pathname = usePathname();
  const k = useGuideKeepsake(code, exhibition, page);
  // A save from this page's card maker lands on this thumbnail: it develops once, and the status settles with it.
  const keptAt = k.state === "saved" || k.state === "stale" ? k.keptAt : undefined;
  const develop = useDevelop(`${code}/${page.page}`, keptAt, "guide");
  // Desktop: a larger card, and the panel hugs its content instead of stretching the column.
  const wide = useWide();
  const scale = wide ? 0.7 : THUMB_SCALE;
  const creator = `/archive/${code}/keepsake?from=guide&page=${page.page}` as const;
  const open = () => {
    track("keepsake_open", { exhibition_code: code, source: "guide_band" });
    router.push(creator);
  };
  const collection = `/archive/${code}` as const;
  const see = strings.seeCollection(exhibition.title);

  // A status that leads to the collection, or plain text when there is nothing to see yet.
  const link = (label: string) => <TextAction label={label} accessibilityLabel={see} trailing="→" href={collection} />;
  const journalOnly = k.lineCount === 0 && k.hasJournal;
  const recordsLabel = journalOnly ? strings.yourJournal : `${plural(k.lineCount, "line")} kept${k.hasJournal ? " · journal" : ""}`;
  const staleLabel =
    k.newLines > 0 ? `${plural(k.newLines, "new line")} since you saved.` : strings.journalChanged;

  let status = null;
  let label = "";
  let action = null;
  switch (k.state) {
    case "guest":
      label = strings.guestStatus;
      status = <Text variant="action">{label}</Text>;
      action = <TextAction label={strings.signIn} trailing="→" href={{ pathname: "/login", params: { returnTo: pathname } }} />;
      break;
    case "error":
      label = strings.guideLoadFailed;
      status = <Notice error message={label} action={{ label: "Retry", onPress: k.retry }} />;
      break;
    case "empty":
      label = hasGuide ? strings.emptyStatus : strings.emptyNoGuide;
      status = <Text variant="action">{label}</Text>;
      action = <TextAction label={strings.makeNow} trailing="→" href={creator} />;
      break;
    case "records":
      label = recordsLabel;
      status = link(label);
      action = <Button label={strings.make} href={creator} />;
      break;
    case "saved":
      label = strings.keptOn(keptDate(k.keptAt));
      status = link(label);
      action = <TextAction label={strings.editCard} trailing="→" href={creator} />;
      break;
    case "stale":
      label = staleLabel;
      status = link(label);
      action = <Button label={strings.update} href={creator} />;
      break;
  }

  // The panel always spans the full column, so its edges line up with the listen row and the rules.
  return (
    <View style={{ flexDirection: "row", gap: spacing.gap, alignItems: "stretch", alignSelf: "stretch", borderWidth: 1, borderColor: colors.black, padding: spacing.gap }}>
      <KeepsakeThumb scale={scale} card={k.card} templateId={k.templateId} placeholder={k.state === "guest" || k.state === "empty" ? strings.placeholder : undefined} entering={k.entering} develop={develop} accessibilityLabel={strings.thumbLabel} accessibilityHint={strings.thumbHint} onPress={open} />
      <View style={{ flex: 1, gap: spacing.tight, minHeight: thumbHeight(scale), justifyContent: "space-between" }}>
        <View style={{ gap: spacing.tight }}>
          <Text variant="subhead">{strings.band}</Text>
          <View accessibilityLiveRegion="polite" style={{ alignItems: "flex-start" }}>
            <InkStatus label={label} develop={develop}>{status}</InkStatus>
          </View>
        </View>
        {/* Content-width, level with the thumbnail's bottom edge. */}
        <View style={{ alignSelf: "flex-start" }}>{action}</View>
      </View>
    </View>
  );
}
