// components/Icon.tsx
// One place that maps an icon NAME to its animation.
//
// Every screen imports <Icon name="home" /> rather than a Lottie path or a
// Lucide component, so swapping an icon later is a one-line change HERE
// instead of an edit to every screen that uses it.
//
// COLOUR IS BAKED INTO LOTTIE. The JSON files are pre-recoloured, and a
// Lottie can't be tinted at runtime the way a Lucide icon can. So where an
// icon needs a different colour, it needs a different FILE — which is why
// several things below exist twice.
//
// STROKES vs FILLS — the rule that decides whether an icon works at all:
//   line/stroke icons     → recolour cleanly
//   mixed stroke + fill   → need an OUTLINE variant (fills hidden, strokes do
//                           the drawing) or a HYBRID (fills kept at 20-45% so
//                           a fill-only element doesn't vanish)
//   pure fill, no strokes → dimming just gives a fainter block; the element
//                           has to be hidden outright, or fall back to Lucide
//   COLOURED ILLUSTRATION → several deliberate colours plus background
//                           scenery. Hiding the scenery and keeping the
//                           subject's palette beats forcing it green.
//   MATTE LAYERS (td:1)   → fills used as track mattes, not visible shapes.
//                           Never recolour or hide these; it breaks the mask.
//   STRAY BACKGROUNDS     → some exports carry a full-canvas rectangle or a
//                           background CARD left over from the design file.
//                           Flattened to green it swallows everything on top.
//   MONOCHROME LOGOS      → the brand marks shipped solid black, invisible on
//                           our background. They take their BRAND colour, not
//                           green — a green Google or Instagram is wrong, and
//                           for Google it breaches their guidelines.
//   BACKGROUND MATTERS    → an icon is only legible against the surface it
//                           sits on. The Apple mark shipped near-white, which
//                           disappears on the white "Continue with Apple"
//                           button, so there's a dark copy for that one place.
//   MIRRORING DOESN'T WORK → flipping an animated composition on its Y axis
//                           looked plausible on paper and flashed and slid on
//                           device. If an icon needs to face the other way,
//                           source it; don't transform it.
//
// NOT EVERYTHING IS A LOTTIE. Three things aren't:
//   components/AtSymbol.tsx   — the @ has no icon in the set, so it's the real
//                               glyph masked, with a light streaking across it.
//   components/SheenIcon.tsx  — wraps any LUCIDE icon in that same light sweep,
//                               in any colour. Used where no animation exists
//                               and never will (keto, low carb, footprints).
//   components/AppleFruit.tsx — the Wholefood apple: a multi-colour SVG whose
//                               beziers would have to be rebuilt by hand to
//                               become a Lottie, so it stays SVG.
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

  /* the log-without-a-photo pen. The page behind it is fills with NO strokes,
     so a flat green version renders as a solid block that swallows the pen —
     and dimming only makes the block fainter. */
  logPen: require("../assets/motion-pen-outline-green.json"),
  logPenClean: require("../assets/motion-pen-clean-green.json"),
  logPenFlat: require("../assets/motion-log-without-search-pen-22C55E.json"),

  mic: require("../assets/motion-mic-22C55E.json"),
  micDark: require("../assets/motion-mic-dark.json"),
  micLine: require("../assets/motion-mic-line-green.json"),

  /* the photo library. Two of its layers are MATTE layers that slide the
     photos behind each other — only the strokes were touched. */
  gallery: require("../assets/motion-gallery-22C55E.json"),

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

  /* a COLOURED ILLUSTRATION — yellow bell, brown outline, on a mint sky. The
     gold version keeps the bell's palette and hides the scenery; an alert
     reading gold rather than green is fine. NOTE: the bell sits smaller in
     its canvas than the line icons, so it renders ~40% larger to match. */
  notification: require("../assets/motion-notification-bell-gold.json"),
  notificationGreen: require("../assets/motion-notification-bell-green.json"),

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

  /* hand-built, since the set has no watch. A heartbeat draws across the
     face — the row is a HEALTH SYNC toggle, so a pulse says what it does. */
  watchHealth: require("../assets/motion-watch-health-22C55E.json"),

  /* ---------- hearts ----------
     TWO versions on purpose. Health data is red across all of iOS, so the
     Apple Health screen and the heart-rate row keep red — a green heart
     beside "Apple Health" fights the platform. "Eat healthier" is an app
     choice rather than health data, so that one is green. */
  heartRed: require("../assets/motion-heart-red.json"),
  heart: require("../assets/motion-heart-22C55E.json"),

  /* ---------- onboarding ---------- */

  /* "Other" on how-did-you-hear. This file shipped with a 65x64 WHITE
     rectangle covering the whole canvas — a leftover background. Its fill is
     hidden in our copy; without that it's a solid white block. */
  otherDots: require("../assets/motion-other-dots-22C55E.json"),

  /* the Apple Health screen's active-minutes row */
  stopwatch: require("../assets/motion-stopwatch-22C55E.json"),

  /* the paywall's "Day 4" row — front and back of a card that flips, driven
     by a matte layer left untouched */
  creditCard: require("../assets/motion-credit-card-22C55E.json"),

  /* ---------- the answers ----------
     Both were replaced. The first "no" flipped an X into a tick, which reads
     as the icon changing its mind; the first "yes" was its twin. These just
     draw the mark and stop. */
  yes: require("../assets/motion-yes2-22C55E.json"),
  no: require("../assets/motion-no2-22C55E.json"),
  yesOld: require("../assets/motion-yes-22C55E.json"),
  noOld: require("../assets/motion-no-22C55E.json"),

  /* ---------- goals ----------
     Use the CHART icons for lose / maintain / gain, not the dumbbell: a chart
     says more about direction than the same dumbbell three times.
     The set has no DOWNWARD chart, and MIRRORING the up one on its Y axis
     failed — 24 animated layers flipped together flashed and slid rather than
     settling. Both directions now use the same climbing chart; at 23px in a
     row it reads as "a chart", which is enough.
     Both charts also carried a background CARD (fill + shine + frame layers)
     flattened to the same green as the bars, so the tile rendered as a solid
     block. Those card layers are hidden in the -clean copies. */
  goalChartUp: require("../assets/motion-goal-chart-up-clean.json"),
  goalChartDown: require("../assets/motion-goal-chart-down-clean.json"),
  goalFlat: require("../assets/motion-goal-flat-line-22C55E.json"),

  targetBullseye: require("../assets/motion-target-bullseye-22C55E.json"),
  dumbbell: require("../assets/motion-dumbbell-22C55E.json"),
  strongArm: require("../assets/motion-strong-arm-22C55E.json"),
  male: require("../assets/motion-male-22C55E.json"),
  female: require("../assets/motion-female-22C55E.json"),
  appleHealth: require("../assets/motion-apple-health-hearbeat-pulse-EF4444.json"),

  /* ---------- diets ----------
     Food should look like food — a green steak reads as nothing. Three
     options have a file here; "Wholefood" is components/AppleFruit.tsx (a
     multi-colour SVG, not a Lottie); the rest use SheenIcon over their Lucide
     icon in the right colour. */
  dietFish: require("../assets/motion-diet-fish-22C55E.json"),
  dietSalad: require("../assets/motion-diet-salad-22C55E.json"),
  /* a carrot — and a GREEN carrot reads as a leaf, so this one is orange.
     Two matte layers drive its reveal and are left untouched. */
  dietVegan: require("../assets/motion-vegan-orange.json"),
  /* the old Apple LOGO. Wrong for a food screen — kept only so anything still
     pointing at it doesn't break. */
  appleLogoFruit: require("../assets/motion-diet-apple-EF4444.json"),
  veganGreen: require("../assets/motion-vegan-22C55E.json"),

  /* accomplish. The calendar's pages were flattened to solid green; several
     of its layers are MATTES driving a page-turn, so only the visible pages
     were dimmed. */
  accomplishCalendar: require("../assets/motion-accomplish-calendar-clean.json"),
  accomplishSmile: require("../assets/motion-accomplish-smiling-face-22C55E.json"),
  friendsFamily: require("../assets/motion-friends-family-22C55E.json"),
  handshake: require("../assets/motion-handshake-or-high-five-22C55E.json"),

  /* ---------- brand logos ----------
     All three shipped MONOCHROME BLACK — invisible on our background. Each
     takes its own brand colour rather than green.
     Note: `google` is the SEARCH icon (a magnifying glass), not the
     four-colour G. Scattering Google's four colours across arbitrary parts of
     a line drawing looks accidental, so it takes their primary blue. */
  google: require("../assets/motion-google-brand.json"),
  tiktok: require("../assets/motion-tiktok-brand.json"),
  instagram: require("../assets/motion-instagram-brand.json"),

  /* the Apple mark, twice. `appStore` is the original near-white (#F5F5F5),
     right on a dark surface; `appleDark` is black, for the WHITE "Continue
     with Apple" button where the light one all but disappears. */
  appStore: require("../assets/motion-appstore-apple-F5F5F5.json"),
  appleDark: require("../assets/motion-apple-dark.json"),

  applePay: require("../assets/motion-apple_pay.json"),
  facebook: require("../assets/motion-facebook-1877F2.json"),
  xTwitter: require("../assets/motion-x-twitter-1DA1F2.json"),
  youtube: require("../assets/motion-youtube-FF0000.json"),
  tv: require("../assets/motion-tv-22C55E.json"),
} as const;

export type IconName = keyof typeof ANIMATIONS;

/* How an icon behaves:
     loop   — always moving. The tab bar uses this: the animations are subtle
              enough that five at once reads as alive, not busy.
     once   — plays through when `playKey` changes. For taps and state changes.
     still  — frozen on the first frame. For rows where motion would be noise,
              or a screen dense enough that thirty loops would cost too much. */
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