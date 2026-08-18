// components/SheenIcon.tsx
// A Lucide icon with the @ symbol's light sweeping across it.
//
// Some things in the app have no Lottie and never will — keto, paleo, low
// carb, footprints. Rather than leave those rows visibly dead beside animated
// ones, or ship a weak hand-drawn icon, this takes the Lucide icon that's
// already correct and gives it the same subtle life everything else has.
//
// Same technique as AtSymbol: the icon is the mask, a white streak passes
// underneath. `delay` staggers rows so a list of them doesn't pulse in
// lockstep, which reads as mechanical rather than alive.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useApp } from "../constants/AppState";

export default function SheenIcon({
  icon: Icon,
  size = 20,
  color,
  delay = 0,
}: {
  /** any lucide-react-native icon component */
  icon: any;
  size?: number;
  /** defaults to the app green */
  color?: string;
  /** ms offset, so a list doesn't sweep in unison */
  delay?: number;
}) {
  const { T } = useApp();
  const base = color || T.green;

  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* one pass, then a pause — a constant sweep reads as a loading bar, an
       occasional one reads as light catching an object */
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
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, [delay]);

  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 1.3, size * 1.3],
  });

  return (
    <MaskedView
      style={{ width: size, height: size }}
      maskElement={
        <View style={s.maskWrap}>
          {/* the mask only cares about shape — the colour here is irrelevant */}
          <Icon size={size} color="#000" />
        </View>
      }
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />

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
            "rgba(255,255,255,0.9)",
            "rgba(255,255,255,0.35)",
            "rgba(255,255,255,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: size * 0.7, height: "180%", marginTop: "-40%" }}
        />
      </Animated.View>
    </MaskedView>
  );
}

const s = StyleSheet.create({
  maskWrap: { backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
});