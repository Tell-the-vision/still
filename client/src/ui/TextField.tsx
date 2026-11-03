import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, fontFamily, fontSize, pageField, spacing } from "./theme";

type Props = Omit<TextInputProps, "onSubmitEditing"> & {
  label: string;
  size?: "line" | "page";
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
};

// The label is the accessible name and the default placeholder; `size="page"` is a tall multiline field.
export function TextField({ label, size = "line", placeholder = label, onSubmit, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={colors.gray}
      onSubmitEditing={onSubmit}
      returnKeyType={onSubmit ? "go" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.field, size === "page" && styles.page, focused && styles.focus, style]}
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
  page: { ...pageField, textAlignVertical: "top" },
  // One 2px edge inside the bounds: the outline overlays the 1px border instead of ringing outside it.
  focus: { outlineWidth: 1, outlineOffset: -1, outlineColor: colors.black, outlineStyle: "solid" },
});
