// components/Tap.tsx
// The app-wide press animation: the card presses in slightly under your finger
// and springs back. Ported from the mockup's Tap — scale 0.965 over 120ms.
// Wrap any tappable card in this instead of a bare Pressable.
import React, { useRef } from "react";
import { Animated, Easing, Pressable, ViewStyle } from "react-native";

type Props = {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
};

export default function Tap({ onPress, children, style, disabled }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.timing(scale, {
      toValue: v,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPressIn={() => to(0.965)}
      onPressOut={() => to(1)}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}