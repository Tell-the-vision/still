import { View } from "react-native";
import { Artwork } from "../../ui/Artwork";
import { Text } from "../../ui/Text";

type Props = {
  title: string;
  venue: { name: string; city: string };
  startDate: string;
  endDate: string;
  coverImage: { url: string; altText: string | null; width: number; height: number } | null;
};

export function GuideHeader({ title, venue, startDate, endDate, coverImage }: Props) {
  return (
    <View>
      {coverImage && <Artwork {...coverImage} />}
      <Text variant="title">{title}</Text>
      <Text variant="secondary">{`${venue.name} · ${venue.city}`}</Text>
      <Text variant="secondary">{`${startDate} – ${endDate}`}</Text>
    </View>
  );
}
