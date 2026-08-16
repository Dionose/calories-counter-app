// components/TravelBorder.tsx
// TRUE conic revolving border using Skia's SweepGradient. Single color OR rainbow.
//
// PHASE SYNC — why the angle doesn't start at 0, and why we listen to AppState:
// Every instance used to begin its rotation at 0 on mount, so a border that
// mounted later sat at a different point in the cycle than one already on
// screen. The starting angle is now anchored to wall-clock time instead.
//
// Backgrounding breaks that anchor: iOS suspends the animation, and on return
// it resumes from where it paused — drifted from the clock, and each instance
// drifted by a different amount. That's why borders looked fine until you
// switched to another app and came back. So we re-anchor every time the app
// becomes active.
import { Canvas, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import React, { useEffect, useState } from "react";
import { AppState, LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import {
  Easing,
  cancelAnimation,
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
    // jump to wherever the shared cycle is right now, then spin from there
    const anchor = () => {
      const phase = (Date.now() % SPIN_MS) / SPIN_MS;
      const start = phase * 360;
      cancelAnimation(angle);
      angle.value = start;
      angle.value = withRepeat(
        withTiming(start + 360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false
      );
    };

    anchor();

    // coming back from another app leaves the animation drifted — re-anchor
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") anchor();
    });

    return () => {
      sub.remove();
      cancelAnimation(angle);
    };
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