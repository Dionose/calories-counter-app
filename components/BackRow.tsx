// components/BackRow.tsx
// The header on every sub-screen. Pulled out because Profile has nine of them
// and they should all sit and animate identically.
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";

export default function BackRow({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <View style={s.row}>
      <Pressable onPress={onBack} hitSlop={12} style={s.btn}>
        <ChevronLeft size={24} color={T.text} />
      </Pressable>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    btn: { width: 32, alignItems: "flex-start", marginLeft: -6 },
    title: { flex: 1, fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    right: { minWidth: 32, alignItems: "flex-end" },
  });