// components/AtSymbol.tsx
// The @ for the username row.
//
// There's no @ in the Lottie set, and drawing one by hand read badly. Instead
// this borrows the M's treatment: the glyph sits still in the app green, and a
// light STREAKS across it on a loop — the same "something alive inside the
// mark" the iso-M has.
//
// Built as a masked glyph rather than a drawn path: the @ character itself is
// the mask, so it uses the app's own font and looks like the @ everywhere else
// rather than an approximation of one. Same technique GradientText uses.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";

export default function AtSymbol({
  size = 20,
  color,
}: {
  size?: number;
  /** defaults to the app green */
  color?: string;
}) {
  const { T } = useApp();
  const base = color || T.green;

  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* one pass every 2.8s, with a pause between — a constant sweep reads as a
       loading bar, an occasional one reads as a highlight catching the light */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // the streak travels from just off the left edge to just off the right
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 1.2, size * 1.2],
  });

  const glyph = {
    fontSize: size,
    lineHeight: Math.ceil(size * 1.28),
    fontFamily: FONTS.headingMed,
    color: "#000",
    includeFontPadding: false as const,
  };

  return (
    <MaskedView
      style={{ width: size * 1.2, height: Math.ceil(size * 1.28) }}
      maskElement={
        <View style={s.maskWrap}>
          <Text style={glyph}>@</Text>
        </View>
      }
    >
      {/* the glyph's own colour, always on */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />

      {/* the light passing through */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }, { rotate: "18deg" }] },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(255,255,255,0)",
            "rgba(255,255,255,0.35)",
            "rgba(255,255,255,0.92)",
            "rgba(255,255,255,0.35)",
            "rgba(255,255,255,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: size * 0.75, height: "180%", marginTop: "-40%" }}
        />
      </Animated.View>
    </MaskedView>
  );
}

const s = StyleSheet.create({
  maskWrap: { backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
});