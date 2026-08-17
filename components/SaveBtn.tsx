// components/SaveBtn.tsx
// Save button that confirms in place — turns to a tick and holds for a beat
// before the screen closes, so a save is never silent.
import { Check } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

export default function SaveBtn({
  saved,
  disabled,
  label = "Save changes",
  savedLabel = "Saved",
  onPress,
}: {
  saved: boolean;
  disabled?: boolean;
  label?: string;
  savedLabel?: string;
  onPress: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <Tap onPress={disabled || saved ? undefined : onPress} style={{ marginTop: 24 }}>
      <View style={[s.btn, disabled && s.disabled, saved && s.saved]}>
        {saved && <Check size={17} color={T.ink} />}
        <Text style={[s.text, disabled && { color: T.micro }]}>
          {saved ? savedLabel : label}
        </Text>
      </View>
    </Tap>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.green, borderRadius: 14, paddingVertical: 15,
    },
    disabled: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    saved: { backgroundColor: T.green },
    text: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
  });