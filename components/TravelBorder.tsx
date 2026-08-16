// components/TravelBorder.tsx
// TRUE conic revolving border using Skia's SweepGradient. Single color OR rainbow.
//
// PHASE SYNC — why the angle doesn't start at 0:
// Every instance used to begin its rotation at 0 on mount, so a border that
// mounted later sat at a different point in the cycle than one already on
// screen — the bright spot top-left on one, bottom-right on the other. That's
// what made pop-out sheets look mismatched against the card behind them.
// Now the starting angle is anchored to wall-clock time, so any border joins
// the cycle already in progress and every border on screen stays in phase.
// This is the same shared-clock fix used in the web mockup for the Calendar
// when new months load in.
import { Canvas, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// one full revolution — every border in the app shares this cycle
const SPIN_MS = 3000;

type Props = {
  color?: string;
  colors?: string[];        // pass this for a revolving rainbow (Ultimate)
  cardBg: string;
  borderColor: string;
  radius?: number;
  strokeWidth?: number;
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function TravelBorder({
  color = "#22C55E",
  colors,
  cardBg,
  borderColor,
  radius = 18,
  strokeWidth = 2.5,
  children,
  style,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const angle = useSharedValue(0);

  useEffect(() => {
    // where the shared cycle is right now, 0..1
    const phase = (Date.now() % SPIN_MS) / SPIN_MS;
    const start = phase * 360;

    // jump straight to that point, then spin a full turn from there and repeat.
    // start and start+360 are the same visual angle, so the loop is seamless.
    angle.value = start;
    angle.value = withRepeat(
      withTiming(start + 360, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setSize({ w: width, h: height });
  };

  const { w, h } = size;
  const cx = w / 2;
  const cy = h / 2;

  const transform = useDerivedValue(() => [
    { rotate: (angle.value * Math.PI) / 180 },
  ]);

  const isRainbow = !!colors;

  // EXACT working single-color config (the one confirmed revolving on device):
  const singleColors = [borderColor, borderColor, borderColor, color, "#ffffff", color, borderColor];
  const singlePositions = [0, 0.55, 0.78, 0.9, 0.95, 0.99, 1];

  // rainbow: wrap the palette fully around, evenly spaced
  const rainbowColors = colors ? [...colors, colors[0]] : [];

  return (
    <View onLayout={onLayout} style={[{ borderRadius: radius }, style]}>
      {w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <RoundedRect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={w - strokeWidth}
            height={h - strokeWidth}
            r={radius}
            style="stroke"
            strokeWidth={strokeWidth}
          >
            {isRainbow ? (
              <SweepGradient
                origin={vec(cx, cy)}
                c={vec(cx, cy)}
                colors={rainbowColors}
                transform={transform}
              />
            ) : (
              <SweepGradient
                origin={vec(cx, cy)}
                c={vec(cx, cy)}
                colors={singleColors}
                positions={singlePositions}
                transform={transform}
              />
            )}
          </RoundedRect>
        </Canvas>
      )}

      <View style={{ backgroundColor: cardBg, borderRadius: radius - strokeWidth, margin: strokeWidth }}>
        {children}
      </View>
    </View>
  );
}