import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { color, font, radius } from "@/theme";

import { useFocusRing } from "./focus";
import { Text } from "./text";

export function Fieldset({ legend, error, children }: { legend: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.fieldset}>
      <Text variant="h2" accessibilityRole="header">
        {legend}
      </Text>
      {error ? (
        <Text variant="bodySm" weight="semibold" tone="warn">
          {error}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** A labelled text input. The error sits under it and is read out with it. */
export function Field({
  label,
  hint,
  error,
  multiline = false,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {hint ? <Text variant="bodySm">{hint}</Text> : null}
      <TextInput
        {...input}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={[hint, error].filter(Boolean).join(". ") || undefined}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        cursorColor={color.navy}
        selectionColor={color.tan}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      />
      {error ? (
        <Text variant="bodySm" weight="semibold" tone="warn">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A radio choice on a paper card: delivery and payment options. */
export function ChoiceCard({
  checked,
  onPress,
  title,
  detail,
  aside,
  disabled = false,
}: {
  checked: boolean;
  onPress: () => void;
  title: string;
  detail: string;
  aside?: string;
  disabled?: boolean;
}) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={aside ? `${title}, ${aside}` : title}
      accessibilityHint={detail}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [
        styles.choice,
        checked ? styles.choiceOn : pressed ? styles.choicePressed : null,
        disabled && styles.disabled,
        focus.ring,
      ]}
    >
      <View style={[styles.radio, checked ? styles.radioOn : styles.radioOff]}>
        {checked ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.choiceText}>
        <Text weight="semibold">{title}</Text>
        <Text variant="bodySm">{detail}</Text>
      </View>
      {aside ? (
        <Text weight="semibold" style={styles.tabular}>
          {aside}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fieldset: { gap: 14 },
  field: { gap: 6 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.primer,
    backgroundColor: color.paper,
    color: color.navy,
    fontFamily: font.regular,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  inputFocused: { borderColor: color.navy, borderWidth: 2 },
  inputError: { borderColor: color.warn, borderWidth: 2 },
  choice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.paper,
    backgroundColor: color.paper,
  },
  choiceOn: { borderColor: color.tan },
  choicePressed: { borderColor: color.primer },
  disabled: { opacity: 0.55 },
  radio: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: color.navy, backgroundColor: color.tan },
  radioOff: { borderColor: color.primer },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.navy },
  choiceText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
