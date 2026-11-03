import { track } from "../../lib/analytics";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { keptDate } from "../../lib/dates";
import { Button } from "../../ui/Button";
import { KeepsakeThumb } from "../../ui/KeepsakeThumb";
import { Notice } from "../../ui/Notice";
import { Text } from "../../ui/Text";
import { TextAction } from "../../ui/TextAction";
import { spacing } from "../../ui/theme";
import { keepsakeStrings as strings } from "./strings";
import { useGuideKeepsake } from "./useGuideKeepsake";

type Props = { code: string; exhibition: Parameters<typeof useGuideKeepsake>[1]; hasGuide: boolean };

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The keepsake band on the Guide: the card as a thumbnail, where it stands, and the one next step.
export function KeepsakePresence({ code, exhibition, hasGuide }: Props) {
  const router = useRouter();
  const k = useGuideKeepsake(code, exhibition);
  const creator = `/archive/${code}/keepsake?from=guide` as const;
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
  let action = null;
  switch (k.state) {
    case "guest":
      status = <Text variant="action">{strings.guestStatus}</Text>;
      action = <TextAction label={strings.signIn} trailing="→" href={{ pathname: "/login", params: { returnTo: `/e/${code}` } }} />;
      break;
    case "error":
      status = <Notice error message={strings.guideLoadFailed} action={{ label: "Retry", onPress: k.retry }} />;
      break;
    case "empty":
      status = <Text variant="action">{hasGuide ? strings.emptyStatus : strings.emptyNoGuide}</Text>;
      action = <TextAction label={strings.makeNow} trailing="→" href={creator} />;
      break;
    case "records":
      status = link(recordsLabel);
      action = <Button label={strings.make} href={creator} />;
      break;
    case "saved":
      status = link(strings.keptOn(keptDate(k.keptAt)));
      action = <TextAction label={strings.editCard} trailing="→" href={creator} />;
      break;
    case "stale":
      status = link(staleLabel);
      action = <Button label={strings.update} href={creator} />;
      break;
  }

  return (
    <View style={{ flexDirection: "row", gap: spacing.gap, alignItems: "flex-start" }}>
      <KeepsakeThumb card={k.card} templateId={k.templateId} placeholder={k.state === "guest" || k.state === "empty" ? strings.placeholder : undefined} entering={k.entering} onPress={open} />
      <View style={{ flex: 1, gap: spacing.tight, minHeight: 77 }}>
        <Text variant="subhead">{strings.band}</Text>
        {/* Loading keeps the room (17 + 8 + 52) and shows nothing, so the page does not jump. */}
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.tight, alignItems: "flex-start" }}>
          {status}
          {action}
        </View>
      </View>
    </View>
  );
}
