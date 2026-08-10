// app/(tabs)/index.tsx  — temporary test of the traveling border
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { DARK, FONTS } from "../../constants/theme";

export default function Home() {
  return (
    <View style={styles.screen}>
      <TravelBorder color={DARK.green} cardBg={DARK.card} borderColor={DARK.border} radius={20}>
        <View style={{ padding: 24 }}>
          <Text style={{ color: DARK.micro, fontSize: 11, letterSpacing: 1, fontFamily: FONTS.body }}>
            CALORIES REMAINING
          </Text>
          <Text style={{ color: DARK.text, fontSize: 42, fontFamily: FONTS.heading, marginTop: 6 }}>
            1,235
          </Text>
        </View>
      </TravelBorder>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DARK.bg,
    justifyContent: "center",
    padding: 20,
  },
});