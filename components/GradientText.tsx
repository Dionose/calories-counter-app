// components/GradientText.tsx
// Text filled with a gradient, used for Ultimate-tier names.
//
// RN can't gradient-fill text directly, so this measures the text, draws the
// gradient at that size, and masks it to the glyphs. The measurement has to be
// generous: a tight box clips descenders and the overhang of letters like y,
// which is exactly what "@Gideony" was doing — losing the tail of the y.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/* LinearGradient wants a tuple of at least two colours, not a plain array —
   an array can't prove to TypeScript that it isn't empty. */
type GradientColors = readonly [string, string, ...string[]];

export default function GradientText({
  text,
  colors,
  fontSize = 16,
  fontFamily,
  letterSpacing,
}: {
  text: string;
  colors: readonly string[];
  fontSize?: number;
  fontFamily?: string;
  letterSpacing?: number;
}) {
  // room for descenders (y, g, p) and the last glyph's overhang — without this
  // the mask crops the tail of the final character
  const lineHeight = Math.ceil(fontSize * 1.42);

  const textStyle = {
    fontSize,
    fontFamily,
    letterSpacing,
    lineHeight,
    // the mask cares about glyph shape, not colour
    color: "#000",
    // a hair of trailing space so the box never ends flush with the ink
    paddingRight: Math.ceil(fontSize * 0.12),
    includeFontPadding: false as const,
  };

  // guarantee at least two stops — a one-colour gradient isn't a gradient
  const stops = (colors.length >= 2 ? colors : [colors[0] || "#22C55E", colors[0] || "#22C55E"]) as GradientColors;

  return (
    <MaskedView
      style={{ height: lineHeight }}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={textStyle} numberOfLines={1}>{text}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={stops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      >
        {/* an invisible copy sets the width the gradient stretches across */}
        <Text style={[textStyle, { opacity: 0 }]} numberOfLines={1}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  maskWrap: { backgroundColor: "transparent", justifyContent: "center" },
});