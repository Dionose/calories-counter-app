import React from "react";
import { Text, View } from "react-native";
import { DARK, FONTS } from "../../constants/theme";

export default function Stats() {
  return (
    <View style={{ flex: 1, backgroundColor: DARK.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: DARK.text, fontFamily: FONTS.heading, fontSize: 20 }}>Stats</Text>
    </View>
  );
}