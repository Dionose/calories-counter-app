// components/IsoM.tsx
// The MOTION brand mark: an extruded "M" at an isometric angle, gently bobbing,
// with a spinning rainbow light behind it.
//
// Ported from the web mockup:
//   IsoM  — 12 masked layers stacked in Z, rotateX(-26°) rotateY(-30°), bob 2s
//   MHero — a conic-gradient disc behind it, blur(24px), opacity .55, spin 4s
// RN has no preserve-3d and no CSS blur, so the rotation is baked into a 2D matrix,
// the depth is drawn as offset copies, and the blur is approximated by a gradual
// radial decay — bright behind the mark, nothing at all by the edge, so there's
// no visible circle.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { ULT_COLORS } from "../constants/theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const MF = "M20 100 L20 22 L42 22 L60 54 L78 22 L100 22 L100 100 L82 100 L82 56 L64 84 L56 84 L38 56 L38 100 Z";
const ISO = "matrix(0.866 0.219 0 0.899 8 -8)";
const DX = -0.5;
const DY = 0.3797;
const DEPTH = 12;

function darken(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", ""), pb = b.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const va = parseInt(pa.slice(i, i + 2), 16);
    const vb = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, "0");
  });
  return `#${out.join("")}`;
}

type Props = {
  size?: number;
  /** a tier hex, or "ultimate" for the rainbow */
  color?: string;
  animated?: boolean;
};

/* ---------- the mark itself ---------- */
export default function IsoM({ size = 92, color = "ultimate", animated = true }: Props) {
  const ultimate = color === "ultimate";

  const bob = useRef(new Animated.Value(0)).current;
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(flow, {
        toValue: 1,
        duration: ultimate ? 3000 : 1700,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [animated, ultimate]);

  const bobAmount = size * 0.055;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [-bobAmount, bobAmount] });
  const flowX = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -120] });

  const sidePaths = [];
  for (let i = 0; i < DEPTH - 1; i++) {
    const z = i - DEPTH / 2;
    sidePaths.push(<Path key={i} d={MF} transform={`translate(${DX * z} ${DY * z}) ${ISO}`} />);
  }
  const frontZ = DEPTH - 1 - DEPTH / 2;
  const frontTransform = `translate(${DX * frontZ} ${DY * frontZ}) ${ISO}`;

  const faceStops = ultimate
    ? [...ULT_COLORS, ...ULT_COLORS, ULT_COLORS[0]].map((c, k, arr) => (
        <Stop key={k} offset={`${(k / (arr.length - 1)) * 100}%`} stopColor={c} />
      ))
    : [
        <Stop key="a" offset="0%" stopColor={color} />,
        <Stop key="b" offset="19%" stopColor={color} />,
        <Stop key="c" offset="25%" stopColor="#FFFFFF" />,
        <Stop key="d" offset="31%" stopColor={color} />,
        <Stop key="e" offset="69%" stopColor={color} />,
        <Stop key="f" offset="75%" stopColor="#FFFFFF" />,
        <Stop key="g" offset="81%" stopColor={color} />,
        <Stop key="h" offset="100%" stopColor={color} />,
      ];

  const sideStops = ultimate
    ? [...ULT_COLORS, ...ULT_COLORS, ULT_COLORS[0]].map((c, k, arr) => (
        <Stop key={k} offset={`${(k / (arr.length - 1)) * 100}%`} stopColor={darken(c, 0.42)} />
      ))
    : [
        <Stop key="a" offset="0%" stopColor={darken(color, 0.42)} />,
        <Stop key="b" offset="50%" stopColor={darken(color, 0.58)} />,
        <Stop key="c" offset="100%" stopColor={darken(color, 0.42)} />,
      ];

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <ClipPath id="isoMFaceClip">
            <Path d={MF} transform={frontTransform} />
          </ClipPath>
          <ClipPath id="isoMSidesClip">{sidePaths}</ClipPath>
          <LinearGradient id="isoMFace" x1="0" y1="0" x2="1" y2="0">{faceStops}</LinearGradient>
          <LinearGradient id="isoMSide" x1="0" y1="0" x2="1" y2="0">{sideStops}</LinearGradient>
        </Defs>

        <G clipPath="url(#isoMSidesClip)">
          <AnimatedRect x={flowX} y={-20} width={240} height={170} fill="url(#isoMSide)" />
        </G>

        <G clipPath="url(#isoMFaceClip)">
          <AnimatedRect x={flowX} y={-20} width={240} height={170} fill="url(#isoMFace)" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/* ---------- the light: a spinning rainbow that fades to nothing ---------- */
function Halo({ size, color }: { size: number; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // 90 wedges interpolated around the ring — a conic gradient without needing one
  const ring = color === "ultimate" ? ULT_COLORS : [color, "#FFFFFF", color, darken(color, 0.6)];
  const N = 90;
  const R = 60;
  const C = 60;
  const wedges = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * ring.length;
    const i = Math.floor(t);
    const f = t - i;
    const col = lerpHex(ring[i % ring.length], ring[(i + 1) % ring.length], f);
    const a0 = (k / N) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((k + 1.6) / N) * 2 * Math.PI - Math.PI / 2;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    wedges.push(<Path key={k} d={`M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={col} />);
  }

  // a gradual decay — no plateau, so there's never a visible rim
  const falloff = [
    [0, 0.62], [8, 0.58], [16, 0.50], [24, 0.41], [32, 0.32],
    [40, 0.24], [48, 0.17], [56, 0.115], [64, 0.072], [72, 0.040],
    [80, 0.019], [88, 0.007], [96, 0.001], [100, 0],
  ];

  return (
    <Animated.View style={{ position: "absolute", width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <RadialGradient id="haloFalloff" cx="50%" cy="50%" r="50%">
            {falloff.map(([o, a], k) => (
              <Stop key={k} offset={`${o}%`} stopColor="#FFFFFF" stopOpacity={a} />
            ))}
          </RadialGradient>
          <Mask id="haloMask">
            <Rect x="0" y="0" width="120" height="120" fill="url(#haloFalloff)" />
          </Mask>
        </Defs>
        <G mask="url(#haloMask)">{wedges}</G>
      </Svg>
    </Animated.View>
  );
}

/* ---------- the hero: light + mark ---------- */
export function IsoMGlow({ size = 92, color = "ultimate", animated = true }: Props) {
  return (
    <View
      style={{
        width: size * 1.9,
        height: size * 1.9,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Halo size={size * 1.8} color={color} />
      <IsoM size={size} color={color} animated={animated} />
    </View>
  );
}