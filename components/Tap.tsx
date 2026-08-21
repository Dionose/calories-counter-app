// components/Tap.tsx
// The app-wide press animation: the card presses in slightly under your finger
// and springs back. Ported from the mockup's Tap — scale 0.965 over 120ms.
// Wrap any tappable card in this instead of a bare Pressable.
//
// HOLD IS OPTIONAL AND RARE. Only a card with a genuine second action takes
// onLongPress — a dish row that opens its ingredients, for instance. A hidden
// gesture is only fair when the card SAYS it's there, so anything using it
// should carry a visible "hold to…" line.
import React, { useRef } from "react";
import { Animated, Easing, Pressable, ViewStyle } from "react-native";

type Props = {
  onPress?: () => void;
  /** a second action on press-and-hold. The card must advertise it. */
  onLongPress?: () => void;
  /** how long the hold has to be. 400ms is the shortest that doesn't fire on
      an ordinary slow tap. */
  longPressDelay?: number;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
};

export default function Tap({
  onPress,
  onLongPress,
  longPressDelay = 400,
  children,
  style,
  disabled,
}: Props) {
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
      onLongPress={onLongPress}
      /* only set the delay when there's something to hold for — passing it
         otherwise changes nothing but reads as though it matters */
      delayLongPress={onLongPress ? longPressDelay : undefined}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}