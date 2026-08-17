// components/Icon.tsx
// One place that maps an icon NAME to its animation.
//
// Every screen imports <Icon name="home" /> rather than a Lottie path or a
// Lucide component, so swapping an icon later is a one-line change HERE
// instead of an edit to every screen that uses it.
//
// COLOUR IS BAKED INTO LOTTIE. The JSON files are pre-recoloured to #22C55E,
// and a Lottie can't be tinted at runtime the way a Lucide icon can. So where
// an icon needs a colour other than green, use the Lucide fallback.
//
// STROKES vs FILLS — the rule that decides whether an icon works at all:
//   line/stroke icons     → recolour cleanly to green
//   mixed stroke + fill   → need an OUTLINE variant (fills hidden, strokes do
//                           the drawing) or a HYBRID (fills kept at 25-45% so
//                           a fill-only element doesn't vanish)
//   pure fill, no strokes → dimming just gives a fainter block; the element
//                           has to be hidden outright, or fall back to Lucide
// Calendar, Stats, Snacks and the log-pen were all the mixed case: flattening
// everything to one green turned them into solid blobs because the fills
// swallowed the internal detail. They use the variants below.
import LottieView from "lottie-react-native";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";

/* Every animation in assets/, keyed by a name the app uses. Add a line here
   and the icon is available everywhere — no screen edits. */
export const ANIMATIONS = {
  /* tabs */
  home: require("../assets/motion-home-22C55E.json"),
  // OUTLINE variant — the flat green one was an unreadable blob
  calendar: require("../assets/motion-calendar-outline-green.json"),
  camera: require("../assets/motion-camera-green.json"),
  cameraDark: require("../assets/motion-camera-dark.json"),
  // HYBRID variant — fills kept at 45% so the board's top bar still shows
  stats: require("../assets/motion-stats-hybrid-green.json"),
  profile: require("../assets/motion-profile-22C55E.json"),

  /* the flat-green originals, kept in case they read properly somewhere the
     background is different */
  calendarFlat: require("../assets/motion-calendar-22C55E.json"),
  statsFlat: require("../assets/motion-stats-22C55E.json"),
  statsOutline: require("../assets/motion-stats-outline-green.json"),
  snacksFlat: require("../assets/motion-snacks-22C55E.json"),

  /* leaderboard — the animation counts 1 → 2 with the hands shifting, so it
     reads as places changing rather than a static cup */
  trophy: require("../assets/motion-trophy-22C55E.json"),

  /* logging hub */
  barcode: require("../assets/motion-barcode-22C55E.json"),
  search: require("../assets/motion-search-line-green.json"),
  searchOutline: require("../assets/motion-search-outline-green.json"),
  searchFood: require("../assets/motion-search-food-22C55E.json"),

  /* the log-without-a-photo pen. The page behind it is 8 fills with NO
     strokes, so a flat green version renders as a solid block that swallows
     the pen — and dimming only makes the block fainter. This is the
     outline version made for exactly that problem. */
  logPen: require("../assets/motion-pen-outline-green.json"),
  logPenClean: require("../assets/motion-pen-clean-green.json"),
  logPenFlat: require("../assets/motion-log-without-search-pen-22C55E.json"),

  mic: require("../assets/motion-mic-22C55E.json"),
  micDark: require("../assets/motion-mic-dark.json"),
  micLine: require("../assets/motion-mic-line-green.json"),

  /* meals */
  breakfast: require("../assets/motion-breakfast-22C55E.json"),
  lunch: require("../assets/motion-lunch-22C55E.json"),
  dinner: require("../assets/motion-home-dinner-22C55E.json"),
  // OUTLINE variant — the wrapper's fills were covering the chocolate segments
  snacks: require("../assets/motion-snacks-outline-green.json"),
  cake: require("../assets/motion-cake-22C55E.json"),

  /* streak tiers */
  flameSpark: require("../assets/motion-flame-spark-3B82F6.json"),
  flameWarming: require("../assets/motion-flame-warming-FBBF24.json"),
  flameHot: require("../assets/motion-flame-hot-FB923C.json"),
  flameRedhot: require("../assets/motion-flame-redhot-EF4444.json"),
  flameUltimate: require("../assets/motion-flame-ultimate-rainbow.json"),

  /* profile rows */
  moonTheme: require("../assets/motion-moon-theme-E5E7EB.json"),
  sunTheme: require("../assets/motion-sunrise-theme-FBBF24.json"),
  reminderBell: require("../assets/motion-reminder-bell-22C55E.json"),
  haptics: require("../assets/motion-haptics-22C55E.json"),
  privacy: require("../assets/motion-privacy-22C55E.json"),
  support: require("../assets/motion-support-22C55E.json"),
  logout: require("../assets/motion-logout-22C55E.json"),
  password: require("../assets/motion-password-22C55E.json"),
  email: require("../assets/motion-email-22C55E.json"),
  region: require("../assets/motion-region-22C55E.json"),
  ruler: require("../assets/motion-ruler-22C55E.json"),
  scale: require("../assets/motion-scale-22C55E.json"),

  /* goals + onboarding */
  goalChartUp: require("../assets/motion-goal-chart-up-22C55E.json"),
  goalChartDown: require("../assets/motion-goal-chart-down-22C55E.json"),
  goalFlat: require("../assets/motion-goal-flat-line-22C55E.json"),
  targetBullseye: require("../assets/motion-target-bullseye-22C55E.json"),
  dumbbell: require("../assets/motion-dumbbell-22C55E.json"),
  strongArm: require("../assets/motion-strong-arm-22C55E.json"),
  male: require("../assets/motion-male-22C55E.json"),
  female: require("../assets/motion-female-22C55E.json"),
  appleHealth: require("../assets/motion-apple-health-hearbeat-pulse-EF4444.json"),

  /* diet */
  dietApple: require("../assets/motion-diet-apple-EF4444.json"),
  dietFish: require("../assets/motion-diet-fish-22C55E.json"),
  dietSalad: require("../assets/motion-diet-salad-22C55E.json"),

  /* accomplish */
  accomplishCalendar: require("../assets/motion-accomplish-calendar-22C55E.json"),
  accomplishHeart: require("../assets/motion-accomplish-heart-22C55E.json"),
  accomplishSmile: require("../assets/motion-accomplish-smiling-face-22C55E.json"),
  friendsFamily: require("../assets/motion-friends-family-22C55E.json"),
  handshake: require("../assets/motion-handshake-or-high-five-22C55E.json"),

  /* answers */
  yes: require("../assets/motion-yes-22C55E.json"),
  no: require("../assets/motion-no-22C55E.json"),

  /* brand logos — keep their own colours */
  google: require("../assets/motion-google.json"),
  applePay: require("../assets/motion-apple_pay.json"),
  appStore: require("../assets/motion-appstore-apple-F5F5F5.json"),
  facebook: require("../assets/motion-facebook-1877F2.json"),
  instagram: require("../assets/motion-instagram-logo.json"),
  tiktok: require("../assets/motion-tiktok.json"),
  xTwitter: require("../assets/motion-x-twitter-1DA1F2.json"),
  youtube: require("../assets/motion-youtube-FF0000.json"),
  tv: require("../assets/motion-tv-22C55E.json"),
} as const;

export type IconName = keyof typeof ANIMATIONS;

/* How an icon behaves:
     loop   — always moving. The tab bar uses this: the animations are subtle
              enough that five at once reads as alive, not busy.
     once   — plays through when `playKey` changes. For taps and state changes.
     still  — frozen on the first frame. For rows where motion would be noise. */
export type IconMode = "loop" | "once" | "still";

export default function Icon({
  name,
  size = 24,
  mode = "still",
  playKey = 0,
  style,
}: {
  name: IconName;
  size?: number;
  mode?: IconMode;
  /** bump this to replay a "once" icon — e.g. when a tab becomes active */
  playKey?: number;
  style?: any;
}) {
  const ref = useRef<LottieView>(null);
  const source = ANIMATIONS[name];

  useEffect(() => {
    if (mode !== "once") return;
    ref.current?.reset();
    ref.current?.play();
  }, [playKey, mode]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <LottieView
        ref={ref}
        source={source}
        autoPlay={mode === "loop"}
        loop={mode === "loop"}
        // a still icon is the first frame, held
        progress={mode === "still" ? 0 : undefined}
        style={{ width: size, height: size }}
      />
    </View>
  );
}