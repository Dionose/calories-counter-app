// components/CutleryIcon.tsx
// A diet-row icon, rendered straight from its source SVG.
//
// These stay SVG rather than becoming Lottie: they're multi-colour artwork
// whose beziers would have to be rebuilt by hand to convert, and the payoff
// would be an animation nobody asked for. The gentle squash below is enough
// to sit beside the animated rows without looking dead.
//
// NOTE: this one shipped BLUE, which reads as a utility icon rather
// than food. Remapped to the app green — it's the neutral 'no specific
// diet' option, so green is right where the others are their own colour.
import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";

export default function CutleryIcon({ size = 24 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scaleX = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const scaleY = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scaleX }, { scaleY }] }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M11.453,38.014c-0.918-0.918-2.412-0.912-3.338,0.014c-0.926,0.926-0.932,2.419-0.014,3.338 s2.412,0.912,3.338-0.014C12.364,40.425,12.371,38.932,11.453,38.014z" fill="#16A34A" />
      <Path d="M18.474,18.3l-2.8,2.8l20.4,20.4c0.8,0.8,2,0.8,2.8,0l0,0c0.8-0.8,0.8-2,0-2.8L18.474,18.3z" fill="#16A34A" />
      <Path d="M15.374,26.5l5.7-5.7L7.174,7l-0.6,0.5c-2.8,2.8-2.8,7.4,0,10.2L15.374,26.5z" fill="#22C55E" />
      <Polygon points="31.503,19.629 30.674,18.8 29.839,17.964 8.264,37.894 9.777,39.697 11.573,41.203" fill="#16A34A" />
      <Path d="M43.185,12.921c-0.458-0.458-1.203-0.454-1.665,0.007l-6.687,6.687 c-0.462,0.462-1.207,0.465-1.665,0.007s-0.455-1.203,0.007-1.665l6.687-6.687c0.461-0.461,0.465-1.207,0.007-1.665 s-1.203-0.454-1.665,0.007l-6.687,6.687c-0.462,0.462-1.207,0.465-1.665,0.007s-0.455-1.203,0.007-1.665l6.687-6.687 c0.461-0.461,0.465-1.207,0.007-1.665c-0.458-0.458-1.203-0.454-1.665,0.007l-9.195,9.195c-1.846,1.846-1.859,4.828-0.028,6.659 l1.658,1.658c1.831,1.831,4.813,1.819,6.659-0.028l9.195-9.195C43.639,14.124,43.642,13.378,43.185,12.921z" fill="#22C55E" />
      </Svg>
    </Animated.View>
  );
}
