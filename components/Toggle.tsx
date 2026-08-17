// components/Toggle.tsx
// A switch we control, replacing RN's <Switch>.
//
// Two reasons: iOS's Switch fires its OWN haptic on every flip, which the
// Profile → Haptics setting can't suppress — so turning haptics off still
// buzzed. And the native switch never quite matched the app's palette.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { useApp } from "../constants/AppState";

const W = 48;
const H_ = 28;
const KNOB = 22;
const PAD = 3;

export default function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { T } = useApp();
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(a, {
      toValue: value ? 1 : 0,
      duration: 190,
      easing: Easing.bezier(0.3, 0.9, 0.35, 1),
      useNativeDriver: false, // backgroundColor can't use the native driver
    }).start();
  }, [value]);

  const translateX = a.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, W - KNOB - PAD],
  });

  const backgroundColor = a.interpolate({
    inputRange: [0, 1],
    outputRange: [T.track, T.green],
  });

  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange(!value)}
      hitSlop={8}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[s.track, { backgroundColor }]}>
        <Animated.View
          style={[
            s.knob,
            { backgroundColor: value ? T.ink : T.micro, transform: [{ translateX }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  track: { width: W, height: H_, borderRadius: H_ / 2, justifyContent: "center" },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, position: "absolute" },
});