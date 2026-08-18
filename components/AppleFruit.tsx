// components/AppleFruit.tsx
// The "Wholefood" apple.
//
// Not a Lottie. The source is a detailed multi-colour SVG — red body, green
// leaf, brown stem, a pale highlight — and converting that to Lottie would
// mean rebuilding every bezier by hand. react-native-svg renders the paths
// directly, so the artwork stays exactly as drawn.
//
// ONE CHANGE from the original: its outlines are pure black (#010101), which
// is invisible on our near-black background. They're a deep warm brown here —
// dark enough to still read as an outline, light enough to actually show.
import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";

const BODY = "#EF4823";
const LEAF = "#38B47B";
const STEM = "#A37B57";
const SHINE = "#D6E5E5";
// the original's #010101 — lifted so the linework survives on a dark card
const LINE = "#6B2A18";

const P_BODY =
  "M41.902,17.466c-0.907-3.548-3.324-6.801-6.708-8.202s-8.435-0.457-10.781,2.355l-2.597-0.09 c-3.259-0.765-6.737-1.52-9.888-0.39c-4.493,1.612-6.946,6.78-6.745,11.549c0.201,4.769,2.513,10.183,5.082,14.206 c1.281,2.005,2.679,4.002,4.612,5.389c1.933,1.387,3.585,2.717,5.809,1.872c0.454-0.173,1.771-1.573,2.813-1.573 c1.085,0,1.624,0.22,2.063,0.646c2.229,2.167,5.032,1.042,7.061-0.185c2.03-1.227,2.039-2.129,3.349-4.106 c2.021-3.054,3.939-7.216,5.151-10.671C42.335,24.811,42.809,21.014,41.902,17.466z";

const P_LEAF =
  "M27.377,6.647c0.419-2.16,2.327-3.632,4.275-4.395c2.198-0.86,4.702-1.069,6.893-0.135 c2.191,0.934,3.767,2.701,3.901,5.194c-1.06-0.613-2.125-0.353-3.29-0.057c-1.669,0.424-2.364,1.662-3.885,2.496 c-1.522,0.834-4.296,1.116-5.358-0.334C29.539,8.906,29.361,8.262,29,7.741S27.896,6.324,27.377,6.647";

const P_STEM =
  "M25.162,14.42c-0.259,0.4-0.693,0.691-1.152,0.796s-1.063-0.466-1.112-0.942 c-0.064-1.193-0.85-2.527-1.609-3.439c-0.981-1.179-2.023-2.306-3.119-3.375c-0.557-0.543-1.181-1.236-0.994-1.997 c0.195-0.797,1.236-1.106,1.991-0.811c0.755,0.294,1.279,0.985,1.762,1.644c1.255,1.711,2.516,3.431,3.485,5.324 C24.873,12.518,25.711,13.575,25.162,14.42z";

const P_SHINE =
  "M17.141,26.796c-0.533,0.453-1.235,0.787-1.904,0.993c-0.229,0.07-0.469,0.125-0.706,0.088 c-0.567-0.088-0.92-0.648-1.181-1.158c-1.154-2.255-0.929-2.283-1.479-4.756c-0.243-1.093-0.362-2.404,0.453-3.172 c0.794-0.748,2.119-0.405,3.189-0.19c-0.492,1.335-0.151,2.343,0.19,3.821C15.828,22.966,16.374,25.541,17.141,26.796z";

const P_OUTLINE =
  "M36.619,9.438c0.18-0.143,0.356-0.286,0.526-0.429c0.67-0.562,1.248-1.046,2.135-1.271 c1.084-0.274,2.021-0.514,2.916,0.006c0.16,0.092,0.356,0.09,0.513-0.006c0.156-0.097,0.247-0.271,0.237-0.454 c-0.135-2.494-1.667-4.546-4.204-5.627c-2.146-0.913-4.727-0.866-7.272,0.129c-2.39,0.936-4.004,2.555-4.5,4.467 c-0.009,0.018-0.011,0.037-0.017,0.055c-1.211,0.659-2.491,2.045-2.718,3.964c-0.878-1.5-1.899-2.908-2.901-4.274 c-0.477-0.649-1.068-1.457-1.984-1.813c-0.568-0.221-1.257-0.184-1.796,0.097c-0.445,0.232-0.752,0.609-0.862,1.062 c-0.271,1.107,0.676,2.03,1.131,2.474c0.947,0.923,1.849,1.903,2.706,2.906c-2.733-0.606-5.879-1.089-8.766-0.054 c-4.9,1.76-7.27,7.39-7.08,12.04c0.18,4.27,2.11,9.68,5.16,14.46c1.22,1.89,2.68,4.04,4.75,5.52l0.3,0.22 c1.86,1.34,3.62,2.61,5.98,1.71c0.21-0.08,0.45-0.27,0.79-0.53c0.52-0.4,1.3-1.01,1.84-1.01c1,0,1.39,0.2,1.71,0.51 c0.94,0.9,2.03,1.36,3.28,1.36c1.3,0,2.77-0.5,4.39-1.48c1.59-0.96,2.05-1.76,2.68-2.88c0.22-0.4,0.48-0.85,0.83-1.38 c1.87-2.82,3.86-6.95,5.2-10.78c1.38-3.91,1.65-7.75,0.8-11.09C41.52,13.944,39.362,11.04,36.619,9.438z M40.65,28.1c-1.32,3.75-3.27,7.8-5.09,10.56c-0.37,0.55-0.64,1.02-0.87,1.44c-0.6,1.05-0.96,1.69-2.32,2.52c-2.83,1.7-4.88,1.79-6.46,0.25c-0.57-0.56-1.27-0.79-2.41-0.79c-0.88,0-1.79,0.71-2.46,1.22c-0.19,0.15-0.45,0.35-0.53,0.39c-1.85,0.71-3.26-0.31-5.03-1.59l-0.31-0.22c-1.92-1.38-3.32-3.43-4.48-5.25c-2.96-4.64-4.83-9.86-5.01-13.96c-0.18-4.29,1.97-9.46,6.42-11.06c3.04-1.095,6.544-0.308,9.4,0.364C42.22,20.74,41.96,24.38,40.65,28.1z";

export default function AppleFruit({ size = 24 }: { size?: number }) {
  /* the same gentle squash the hand-built one had — subtle enough to match
     the rest of the icon set rather than draw attention */
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
        <Path fill={BODY} d={P_BODY} />
        <Path fill={LEAF} d={P_LEAF} />
        <Path fill={STEM} d={P_STEM} />
        <Path fill={SHINE} d={P_SHINE} />
        <Path fill={LINE} d={P_OUTLINE} />
      </Svg>
    </Animated.View>
  );
}