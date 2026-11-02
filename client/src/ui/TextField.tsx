import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, focusRing, fontFamily, fontSize, spacing } from "./theme";

type Props = Omit<TextInputProps, "placeholder" | "onSubmitEditing"> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
};

// The label doubles as the placeholder; there is no separate visible label.
export function TextField({ label, onSubmit, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={colors.gray}
      onSubmitEditing={onSubmit}
      returnKeyType={onSubmit ? "go" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.field, focused && styles.focus, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.black,
    padding: spacing.inset,
  },
  focus: focusRing,
});
