// components/ViewTransition.tsx
// The slide-and-fade between views inside a single screen.
//
// ⚠️ WHY THIS EXISTS AT ALL. Stats, Profile and Calendar don't navigate — they
// swap a `view` value and re-render. There's no route change, so the router has
// nothing to animate, and every one of those transitions just SNAPPED: tap into
// Privacy, tap back, and the screen changes with no sense of having gone
// anywhere. Dion noticed it on the calorie chart and then realised it was
// everywhere.
//
// The fix isn't to make them real routes — swapping a value is the right
// pattern for a detail view that belongs to its tab, and converting them all
// would be a large change for a visual problem. It's to animate the swap
// ourselves.
//
// ONBOARDING ALREADY HAD THIS. Its StepTransition has been sliding fifteen
// screens along smoothly the whole time, and none of the tabs used it because
// it was written inline in that file. This is that component, lifted out.
//
// DIRECTION IS THE POINT. Forward slides in from the RIGHT, back from the
// LEFT — the same grammar iOS uses, and the thing that makes a transition feel
// like navigation rather than decoration. A back gesture that animates forward
// is worse than no animation at all, because it says the wrong thing.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, ViewStyle } from "react-native";

/* HOW FAR IT TRAVELS. 34 points — enough to read as movement, short enough
   that it never looks like the screen is sliding in from off-stage. A big
   travel on a fast animation reads as a jolt. */
const TRAVEL = 34;

/* 300ms in, and it matters that it's not faster. Below about 250 the eye
   registers a flicker rather than a movement, which is how "snappy" animations
   end up feeling broken; above 350 the app starts to feel like it's waiting
   for you. */
const DURATION = 300;

export default function ViewTransition({
  /** changes whenever the view changes — that's what restarts the animation.
      Use the view's own name or id, never an index that might repeat. */
  viewKey,
  /** 1 going deeper, -1 coming back. See the note above about why this can't
      just be a fixed direction. */
  direction = 1,
  style,
  children,
}: {
  viewKey: string;
  direction?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /* reset before starting, not after. Starting from wherever the last
       animation happened to stop would make a fast double-tap slide from a
       half-position. */
    anim.setValue(0);

    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION,
      /* out-fast, in-slow: quick to commit, gentle to settle. The same curve
         onboarding uses, so the whole app moves the same way. */
      easing: Easing.bezier(0.22, 0.9, 0.3, 1),
      /* the transform and opacity both run on the native thread, so this
         stays smooth even while the screen behind it is fetching */
      useNativeDriver: true,
    }).start();
  }, [viewKey, direction]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [TRAVEL * direction, 0],
  });

  return (
    <Animated.View
      style={[
        styles.fill,
        style,
        { opacity: anim, transform: [{ translateX }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});