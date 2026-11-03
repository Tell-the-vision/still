import { longRange, year } from "../../lib/dates";
import { Artwork } from "../../ui/Artwork";
import { View } from "react-native";
import { Text } from "../../ui/Text";
import { spacing } from "../../ui/theme";
import { guideStrings } from "./strings";

type Props = {
  title: string;
  venue: { name: string; city: string };
  startDate: string;
  endDate: string;
  coverImage: { url: string; altText: string | null; width: number; height: number } | null;
};

export function GuideHeader({ title, venue, startDate, endDate, coverImage }: Props) {
  return (
    <View style={{ gap: spacing.tight }}>
      <Text variant="eyebrow">{guideStrings.eyebrow(year(startDate))}</Text>
      <Text variant="display">{title}</Text>
      <Text variant="eyebrow">{venue.name}</Text>
      <Text variant="secondary">{`${venue.city} · ${longRange(startDate, endDate)}`}</Text>
      {coverImage && <Artwork {...coverImage} caption={guideStrings.viewCaption} />}
    </View>
  );
}
