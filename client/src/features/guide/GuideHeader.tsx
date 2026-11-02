import { View } from "react-native";
import { Text } from "../../ui/Text";

type Props = {
  title: string;
  venue: { name: string; city: string };
  startDate: string;
  endDate: string;
};

export function GuideHeader({ title, venue, startDate, endDate }: Props) {
  return (
    <View>
      <Text variant="title">{title}</Text>
      <Text variant="secondary">{`${venue.name} · ${venue.city}`}</Text>
      <Text variant="secondary">{`${startDate} – ${endDate}`}</Text>
    </View>
  );
}
