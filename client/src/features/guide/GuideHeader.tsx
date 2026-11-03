import { View } from "react-native";
import { longRange } from "../../lib/dates";
import { Artwork } from "../../ui/Artwork";
import { Text } from "../../ui/Text";
import { spacing } from "../../ui/theme";

type Props = {
  title: string;
  venue: { name: string; city: string };
  startDate: string;
  endDate: string;
  coverImage: { url: string; altText: string | null; width: number; height: number } | null;
};

// Title, meta line and the cover: the work comes first (SPEC §3.1). The cover carries no caption and
// spans the full column, so its edges line up with the listen row and the keepsake panel below.
export function GuideHeader({ title, venue, startDate, endDate, coverImage }: Props) {
  return (
    <View style={{ gap: spacing.tight }}>
      <Text variant="display">{title}</Text>
      <Text variant="secondary">{`${venue.name}, ${venue.city} · ${longRange(startDate, endDate)}`}</Text>
      {coverImage && (
        <View style={{ marginTop: spacing.tight }}>
          <Artwork {...coverImage} />
        </View>
      )}
    </View>
  );
}
