// components/TravelBorder.tsx
// TRUE conic revolving border using Skia's SweepGradient (real conic gradient).
import {
    Canvas,
    RoundedRect,
    SweepGradient,
    vec
} from "@shopify/react-native-skia";
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import {
    Easing,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

type Props = {
  color: string;
  cardBg: string;
  borderColor: string;
  radius?: number;
  strokeWidth?: number;
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function TravelBorder({
  color,
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
    angle.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
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

  // rotate the sweep gradient's center transform each frame
  const transform = useDerivedValue(() => [
    { rotate: (angle.value * Math.PI) / 180 },
  ]);

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
            <SweepGradient
              origin={vec(cx, cy)}
              c={vec(cx, cy)}
              colors={[
                borderColor,
                borderColor,
                borderColor,
                color,
                "#ffffff",
                color,
                borderColor,
              ]}
              positions={[0, 0.55, 0.78, 0.9, 0.95, 0.99, 1]}
              transform={transform}
            />
          </RoundedRect>
        </Canvas>
      )}

      {/* card content */}
      <View style={{ backgroundColor: cardBg, borderRadius: radius - strokeWidth, margin: strokeWidth }}>
        {children}
      </View>
    </View>
  );
}