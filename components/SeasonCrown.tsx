// components/SeasonCrown.tsx
// The season badge for the Total leaderboard: a crown in the user's season
// tier, with the number of seasons finished at that tier set in the centre.
// A higher tier REPLACES the lower one — you only ever wear one colour.
//
// PERFORMANCE — read before changing, this was tested the hard way:
// The sheen animates strokeDashoffset over a path with hundreds of segments.
// Running it on ten crowns freezes the app — and that holds EVEN on Reanimated
// with the animation on the UI thread, because the cost is the SVG redraw, not
// the bridge. So the sheen runs ONLY on the reveal crown, where there is one.
// Everything in a list gets the float and nothing else.
//
// BACKGROUNDING: iOS suspends animations when you leave the app and resumes
// them where they paused, so crowns come back bobbing out of step with each
// other. Both loops re-anchor whenever the app becomes active.
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, AppState, Easing, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { FONTS, ULT_COLORS } from "../constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SHEEN = "#FFF0B8";

// measured length of the crown outline in its 100-unit viewBox. react-native-svg
// has no pathLength, so the dash values below are absolute rather than percentages.
const PATH_LEN = 1165;

let uid = 0;

const CROWN =
  "M 55.001953 14.90625 C 53.42785 14.90625 52.120528 15.54394 51.279297 16.505859 C 50.438066 17.467779 50.042969 18.706757 50.042969 19.931641 C 50.042969 21.156524 50.438066 22.395502 51.279297 23.357422 C 51.894049 24.06037 52.760136 24.585995 53.794922 24.820312 L 45.802734 48.390625 L 31.191406 27.740234 C 31.415707 27.588807 31.623333 27.42139 31.792969 27.224609 C 32.357859 26.569325 32.613281 25.743404 32.613281 24.931641 C 32.613281 24.119877 32.357859 23.293956 31.792969 22.638672 C 31.228079 21.983388 30.329563 21.546875 29.300781 21.546875 C 28.271999 21.546875 27.373484 21.983388 26.808594 22.638672 C 26.243704 23.293956 25.988281 24.119877 25.988281 24.931641 C 25.988281 25.743404 26.243704 26.569325 26.808594 27.224609 C 27.195117 27.672984 27.74513 28.005921 28.378906 28.179688 L 24.152344 53.416016 C 23.741446 53.661778 22.173709 54.59255 21.087891 55.207031 L 7.6113281 35.822266 C 8.1838012 35.594253 8.6803179 35.258064 9.0546875 34.832031 C 9.741358 34.0506 10.060547 33.05209 10.060547 32.066406 C 10.060547 31.080723 9.741358 30.080259 9.0546875 29.298828 C 8.368017 28.517397 7.2938051 28.001953 6.03125 28.001953 C 4.7686949 28.001953 3.6964362 28.517397 3.0097656 29.298828 C 2.3230951 30.080259 2.0039062 31.080723 2.0039062 32.066406 C 2.0039062 33.05209 2.3230951 34.0506 3.0097656 34.832031 C 3.5398961 35.43532 4.303214 35.872964 5.203125 36.044922 L 14.988281 73.132812 A 1.0001 1.0001 0 0 0 15.234375 73.570312 C 15.234375 73.570312 17.895211 76.296775 24.111328 78.576172 C 30.327445 80.855568 40.183355 82.78331 54.84375 81.533203 C 69.677909 80.268435 77.939495 76.591323 82.519531 73.126953 C 84.809549 71.394768 86.172394 69.717372 86.962891 68.449219 C 87.753387 67.181065 87.994141 66.232422 87.994141 66.232422 A 1.0001 1.0001 0 0 0 88.005859 66.169922 L 94.595703 27.931641 C 95.570888 27.799539 96.405141 27.366482 96.96875 26.732422 C 97.644023 25.97274 97.958984 24.999286 97.958984 24.039062 C 97.958984 23.07884 97.644023 22.105385 96.96875 21.345703 C 96.293477 20.586021 95.241812 20.087891 94.007812 20.087891 C 92.773814 20.087891 91.720194 20.586021 91.044922 21.345703 C 90.369649 22.105385 90.054688 23.07884 90.054688 24.039062 C 90.054688 24.999285 90.369649 25.97274 91.044922 26.732422 C 91.397791 27.1294 91.857424 27.449544 92.388672 27.669922 L 81.207031 51.722656 L 77.433594 50.027344 L 73.142578 28.056641 C 73.977703 27.921719 74.696731 27.530553 75.183594 26.972656 C 75.786222 26.282105 76.0625 25.405388 76.0625 24.542969 C 76.0625 23.68055 75.786222 22.803833 75.183594 22.113281 C 74.580966 21.42273 73.63118 20.966797 72.533203 20.966797 C 71.435226 20.966797 70.485441 21.42273 69.882812 22.113281 C 69.280185 22.803833 69.003906 23.68055 69.003906 24.542969 C 69.003906 25.405388 69.280185 26.282105 69.882812 26.972656 C 70.152176 27.28132 70.498359 27.533366 70.888672 27.728516 L 63.126953 44.367188 C 62.60683 42.832181 62.10338 41.3918 61.591797 39.867188 C 60.135061 35.525846 58.774476 31.447938 57.761719 28.480469 C 57.25534 26.996734 56.837962 25.790956 56.533203 24.960938 C 56.500852 24.872828 56.482792 24.835239 56.453125 24.755859 C 57.379326 24.497484 58.159109 24.004053 58.724609 23.357422 C 59.565841 22.395502 59.962891 21.156524 59.962891 19.931641 C 59.962891 18.706757 59.565841 17.467779 58.724609 16.505859 C 57.883378 15.54394 56.576056 14.90625 55.001953 14.90625 z M 55.001953 16.90625 C 56.067849 16.90625 56.739982 17.27481 57.21875 17.822266 C 57.697518 18.369721 57.962891 19.144024 57.962891 19.931641 C 57.962891 20.719257 57.697518 21.49356 57.21875 22.041016 C 56.739982 22.588471 56.067849 22.957031 55.001953 22.957031 C 54.953386 22.957031 54.916091 22.946825 54.869141 22.945312 C 54.34727 22.522834 53.429153 21.589883 53.294922 20.068359 C 53.147024 18.391903 54.458339 17.253942 54.900391 16.916016 C 54.936608 16.915127 54.964787 16.90625 55.001953 16.90625 z M 94.853516 22.236328 C 95.110026 22.339994 95.30919 22.489929 95.472656 22.673828 C 95.781383 23.021146 95.958984 23.523286 95.958984 24.039062 C 95.958984 24.554841 95.781383 25.056979 95.472656 25.404297 C 95.163929 25.751615 94.741812 25.990234 94.007812 25.990234 C 93.922578 25.990234 93.854524 25.976935 93.777344 25.970703 C 93.544115 25.536321 93.331285 24.91186 93.419922 24.150391 C 93.545655 23.065557 94.438243 22.462163 94.853516 22.236328 z M 72.533203 22.966797 C 73.121892 22.966797 73.437029 23.153863 73.677734 23.429688 C 73.918439 23.70551 74.0625 24.116888 74.0625 24.542969 C 74.0625 24.96905 73.918439 25.380426 73.677734 25.65625 C 73.437029 25.932074 73.121892 26.119141 72.533203 26.119141 C 71.944514 26.119141 71.629377 25.932074 71.388672 25.65625 C 71.147967 25.380426 71.003906 24.96905 71.003906 24.542969 C 71.003906 24.116888 71.147967 23.705511 71.388672 23.429688 C 71.629377 23.153863 71.944514 22.966797 72.533203 22.966797 z M 29.300781 23.546875 C 29.813999 23.546875 30.073187 23.706221 30.279297 23.945312 C 30.485406 24.184404 30.613281 24.550904 30.613281 24.931641 C 30.613281 25.312377 30.485406 25.678878 30.279297 25.917969 C 30.168616 26.04636 30.037645 26.148677 29.865234 26.21875 A 1.0001 1.0001 0 0 0 29.517578 26.171875 A 1.0001 1.0001 0 0 0 29.080078 26.296875 C 28.715313 26.255285 28.496858 26.118234 28.324219 25.917969 C 28.118109 25.678878 27.988281 25.312377 27.988281 24.931641 C 27.988281 24.550904 28.118109 24.184405 28.324219 23.945312 C 28.530328 23.706222 28.787564 23.546875 29.300781 23.546875 z M 55.146484 27.058594 C 55.37701 27.71443 55.569231 28.246238 55.869141 29.125 C 56.877696 32.080156 58.237799 36.160248 59.695312 40.503906 C 62.61034 49.191223 65.892656 58.888489 67.609375 62.9375 A 1.0001 1.0001 0 0 0 68.666016 63.537109 C 72.611656 62.998113 75.331738 62.048293 77.082031 61.210938 C 78.832325 60.373582 79.683594 59.582031 79.683594 59.582031 A 1.0001 1.0001 0 0 0 79.900391 59.279297 L 82.486328 53.716797 A 1.0001 1.0001 0 0 0 82.722656 53.208984 L 91.441406 34.451172 L 86.044922 65.779297 C 86.043522 65.785697 85.926007 66.331208 85.265625 67.390625 C 84.601372 68.456253 83.412482 69.94281 81.3125 71.53125 C 77.112536 74.70813 69.24367 78.298784 54.673828 79.541016 C 40.262223 80.769908 30.716211 78.869072 24.798828 76.699219 C 19.145259 74.626104 17.032501 72.509267 16.841797 72.314453 L 8.4589844 40.544922 L 25.273438 64.728516 A 1.0001 1.0001 0 0 0 25.835938 65.123047 C 30.567001 66.395737 35.588702 67.052364 41.015625 66.769531 A 1.0001 1.0001 0 0 0 41.910156 66.091797 L 55.146484 27.058594 z M 6.03125 30.001953 C 6.7880274 30.001953 7.2297387 30.251572 7.5527344 30.619141 C 7.8757301 30.98671 8.0605469 31.52009 8.0605469 32.066406 C 8.0605469 32.612723 7.8757301 33.14415 7.5527344 33.511719 C 7.2297387 33.879288 6.7880274 34.130859 6.03125 34.130859 C 5.92151 34.130859 5.8313932 34.115635 5.734375 34.105469 C 5.3643346 33.637342 5.0131044 32.993128 4.9375 32.142578 C 4.8603756 31.275049 5.2341349 30.554894 5.6445312 30.035156 C 5.7662116 30.018229 5.8882951 30.001953 6.03125 30.001953 z M 71.740234 31.306641 L 75.570312 50.917969 A 1.0001 1.0001 0 0 0 76.140625 51.638672 L 80.363281 53.537109 L 79.541016 55.308594 L 74.207031 52.949219 L 71.183594 34.320312 L 71.740234 31.306641 z M 29.78125 31.923828 L 32.257812 59.490234 C 30.180869 60.148203 28.040439 61.065282 26.046875 62.337891 L 22.234375 56.853516 C 23.623086 56.063737 25.576172 54.898437 25.576172 54.898438 A 1.0001 1.0001 0 0 0 26.046875 54.207031 L 29.78125 31.923828 z M 13.134766 50.894531 L 18.982422 71.830078 C 19.597422 72.333078 22.111375 74.114422 28.234375 75.607422 L 31.71875 68.072266 C 28.15975 67.540266 24.682516 66.708203 22.978516 65.408203 L 22.839844 65.302734 L 22.744141 65.15625 C 20.380141 61.49525 16.131766 55.261531 13.134766 50.894531 z M 68.232422 58.916016 C 68.822634 58.967925 69.517924 59.041608 70.28125 59.167969 C 71.608646 59.387706 73.00292 59.820647 73.896484 60.289062 C 72.619495 60.696251 71.071531 61.087961 69.181641 61.392578 C 68.91572 60.745416 68.562798 59.790215 68.232422 58.916016 z M 41.917969 59.84375 L 40.253906 64.751953 C 35.885907 64.915348 31.793822 64.464534 27.894531 63.548828 C 33.312166 60.435238 39.645973 59.930287 41.917969 59.84375 z M 55.976562 60.007812 C 53.978634 60.007812 52.385345 61.135102 51.429688 62.654297 C 50.474029 64.173492 50.042969 66.080205 50.042969 67.980469 C 50.042969 69.880733 50.474029 71.787446 51.429688 73.306641 C 52.385345 74.825836 53.978634 75.951172 55.976562 75.951172 C 57.720886 75.951172 59.249822 74.945744 60.28125 73.488281 C 61.312678 72.030818 61.910156 70.096965 61.910156 67.980469 C 61.910156 65.863973 61.312678 63.930119 60.28125 62.472656 C 59.249822 61.015193 57.720885 60.007812 55.976562 60.007812 z M 55.976562 62.007812 C 56.957215 62.007812 57.896064 62.561049 58.650391 63.626953 C 59.404718 64.692858 59.910156 66.246435 59.910156 67.980469 C 59.910156 69.714502 59.404718 71.266127 58.650391 72.332031 C 58.001056 73.249577 57.214574 73.786075 56.382812 73.917969 C 55.762777 73.014082 54.943963 71.308203 54.734375 68.361328 C 54.53567 65.566997 55.239851 63.221592 55.695312 62.025391 C 55.788295 62.018407 55.878897 62.007812 55.976562 62.007812 z M 35.394531 68.525391 L 31.087891 76.226562 C 32.452891 76.487562 33.964141 76.730359 35.619141 76.943359 L 40.001953 68.880859 C 38.749953 68.810859 37.139531 68.700391 35.394531 68.525391 z";

function starPath(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i ? "L" : "M"}${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
  }
  return d + "Z";
}

type Props = {
  /** a tier hex, or "ultimate" for the rainbow */
  color?: string;
  /** seasons finished at this tier */
  count: number;
  size?: number;
  /** play the full reveal instead of showing it settled */
  sequence?: boolean;
  /** bump to replay the sequence */
  playKey?: number;
  /** the travelling light. Defaults to ON only for the reveal crown. Never
      switch it on for a list — it freezes, and Reanimated does not rescue it. */
  sheen?: boolean;
};

export default function SeasonCrown({
  color = "ultimate",
  count,
  size = 48,
  sequence = false,
  playKey = 0,
  sheen,
}: Props) {
  const ult = color === "ultimate";
  const id = useMemo(() => `sc${++uid}`, []);
  const metal = ult ? `url(#metal-${id})` : color;
  const numColor = ult ? "#FFFFFF" : color;

  // only the reveal crown glows unless a caller insists
  const withSheen = sheen ?? sequence;

  const bob = useRef(new Animated.Value(0)).current;
  const flow = useRef(new Animated.Value(0)).current;

  const intro = useRef(new Animated.Value(sequence ? 0 : 1)).current;
  const spread = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const num = useRef(new Animated.Value(sequence ? 0 : 1)).current;

  // the float — native driver, so it costs nothing even with ten on screen.
  // Restarted on foreground so crowns don't come back bobbing out of step.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;

    const start = () => {
      loop?.stop();
      bob.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
    };

    start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") start();
    });

    return () => {
      sub.remove();
      loop?.stop();
    };
  }, []);

  // the sheen — its own loop, reset on mount and on foreground so it always
  // runs rather than sitting frozen mid-lap
  useEffect(() => {
    if (!withSheen) return;
    let loop: Animated.CompositeAnimation | undefined;

    const start = () => {
      loop?.stop();
      flow.setValue(0);
      loop = Animated.loop(
        Animated.timing(flow, {
          toValue: 1,
          duration: 3400,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loop.start();
    };

    start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") start();
    });

    return () => {
      sub.remove();
      loop?.stop();
    };
  }, [withSheen]);

  // the reveal
  useEffect(() => {
    if (!sequence) return;
    intro.setValue(0);
    spread.setValue(0);
    spin.setValue(0);
    num.setValue(0);

    Animated.sequence([
      Animated.spring(intro, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(spread, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.bezier(0.35, 0.02, 0.28, 1), useNativeDriver: true }),
      Animated.timing(spread, { toValue: 0, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(num, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
    ]).start();
  }, [playKey, sequence, count, color]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.05, size * 0.05] });
  const dashOffset = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -PATH_LEN] });
  const introScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const orbit = size * 0.5;
  const rings = count > 8 ? 2 : 1;
  const perRing = Math.ceil(count / rings);
  const starSize = Math.max(10, size * 0.145);

  const crown = (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`metal-${id}`} x1="0" y1="0" x2="1" y2="1">
          {ULT_COLORS.map((c, i) => (
            <Stop key={i} offset={`${(i / (ULT_COLORS.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>

      <Path d={CROWN} fill={metal} fillRule="evenodd" />

      {withSheen && (
        <>
          <AnimatedPath
            d={CROWN}
            fill="none"
            stroke={SHEEN}
            strokeWidth={2.6}
            strokeOpacity={0.3}
            strokeLinecap="round"
            strokeDasharray={[90, PATH_LEN - 90]}
            strokeDashoffset={dashOffset as any}
          />
          <AnimatedPath
            d={CROWN}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={0.9}
            strokeOpacity={0.9}
            strokeLinecap="round"
            strokeDasharray={[38, PATH_LEN - 38]}
            strokeDashoffset={dashOffset as any}
          />
        </>
      )}

      <Circle cx="44" cy="52" r="13" fill="#0A0A0A" opacity={0.9} />
      <Circle cx="44" cy="52" r="13" fill="none" stroke={metal} strokeWidth="1.6" />
      <SvgText
        x="44"
        y="57.5"
        textAnchor="middle"
        fontSize="15"
        fill={numColor}
        fontFamily={FONTS.heading}
      >
        {count}
      </SvgText>
    </Svg>
  );

  // settled — just the float
  if (!sequence) {
    return (
      <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
        {crown}
      </Animated.View>
    );
  }

  // the reveal, with room for the stars to orbit
  const box = size * 2.1;
  return (
    <View style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: box,
          height: box,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate }],
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const ringIdx = Math.floor(i / perRing);
          const idxInRing = i % perRing;
          const inThis = ringIdx === rings - 1 ? count - perRing * ringIdx : perRing;
          const a = (idxInRing / inThis) * Math.PI * 2 - Math.PI / 2;
          const r = orbit + ringIdx * starSize * 1.5;

          const lo = Math.min(0.5, i * 0.035);
          const grow = spread.interpolate({
            inputRange: [0, lo, Math.min(1, lo + 0.5), 1],
            outputRange: [0, 0, 1, 1],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                opacity: grow,
                transform: [
                  { translateX: Animated.multiply(grow, Math.cos(a) * r) },
                  { translateY: Animated.multiply(grow, Math.sin(a) * r) },
                  { scale: grow },
                ],
              }}
            >
              <Svg width={starSize} height={starSize} viewBox="0 0 26 26">
                <Path
                  d={starPath(13, 13, 12.4)}
                  fill={ult ? ULT_COLORS[i % ULT_COLORS.length] : color}
                />
              </Svg>
            </Animated.View>
          );
        })}
      </Animated.View>

      <Animated.View
        style={{
          width: size,
          height: size,
          opacity: intro,
          transform: [{ translateY }, { scale: introScale }],
        }}
      >
        <Animated.View style={{ opacity: num }}>{crown}</Animated.View>
      </Animated.View>
    </View>
  );
}