// app/(tabs)/index.tsx
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, HelpCircle, Plus, X } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import ExpectedWeightSheet from "../../components/ExpectedWeightSheet";
import GradientText from "../../components/GradientText";
import Icon, { IconName } from "../../components/Icon";
import MealSheet from "../../components/MealSheet";
import PageHeader from "../../components/PageHeader";
import SeasonCrown from "../../components/SeasonCrown";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { loadDay, Meal, todayLocal } from "../../constants/meals";
import { FONTS, tierForStreak, TIERS, ULT_COLORS } from "../../constants/theme";
import { expectedKgToday, fromKg, loadWeighIns, toKg } from "../../constants/weight";

const SCREEN_H = Dimensions.get("window").height;

// Both sheets get an EXPLICIT height — TravelBorder's card sizes to its content.
const SHEET_H = Math.round(SCREEN_H * 0.72);
const HERO_H = Math.round(SCREEN_H * 0.62);

const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-19" → "Aug 19". Split by hand rather than with new Date(string),
    which reads a bare date as UTC and can land a day out — the same trap
    todayLocal() exists to avoid. */
function shortDay(isoDate: string): string | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return `${MSHORT[m - 1]} ${d}`;
}

/* How far over the target before the wording gets firmer. Below this you've
   essentially hit your number — estimates carry more error than 150 calories,
   so treating 40 over as a miss would be pretending to a precision the app
   doesn't have. */
const OVER_THRESHOLD = 150;

/* The four meal slots always show, logged or not — an empty Dinner row IS the
   prompt to log dinner. `typical` is what a meal of that kind usually runs to,
   used only to spot a suspiciously light entry. */
const MEAL_SLOTS: { name: string; key: string; typical: number; icon: IconName }[] = [
  { name: "Breakfast", key: "breakfast", typical: 450, icon: "breakfast" },
  { name: "Lunch", key: "lunch", typical: 600, icon: "lunch" },
  { name: "Dinner", key: "dinner", typical: 700, icon: "dinner" },
  { name: "Snacks", key: "snacks", typical: 200, icon: "snacks" },
];

/** the flame animation for a tier — a dedicated file per tier reads far better
    than one generic flame tinted five ways */
const FLAME_FOR_TIER: Record<string, IconName> = {
  Spark: "flameSpark",
  Warming: "flameWarming",
  Hot: "flameHot",
  "Red-hot": "flameRedhot",
  Ultimate: "flameUltimate",
};

/* SEASON boards — General and Regional reset every season.
   STILL STAND-IN DATA. A real leaderboard needs a server-side ranking query
   across every user, which is its own piece of work. */
const BOARD_FULL = [
  { rank: 1, handle: "amara_k", pts: 412, days: 21 },
  { rank: 2, handle: "dionj", pts: 388, days: 14, me: true },
  { rank: 3, handle: "kwame.b", pts: 356, days: 12 },
  { rank: 4, handle: "lena.m", pts: 341, days: 11 },
  { rank: 5, handle: "tomiwa", pts: 318, days: 10 },
  { rank: 6, handle: "sofia_r", pts: 294, days: 9 },
  { rank: 7, handle: "nate", pts: 271, days: 7 },
  { rank: 8, handle: "yusuf.a", pts: 255, days: 6 },
  { rank: 9, handle: "priya", pts: 233, days: 5 },
  { rank: 10, handle: "marcus", pts: 210, days: 3 },
  { rank: 11, handle: "chidera", pts: 204, days: 18 },
  { rank: 12, handle: "hana_s", pts: 198, days: 15 },
  { rank: 13, handle: "olu.a", pts: 191, days: 13 },
  { rank: 14, handle: "mei_l", pts: 186, days: 12 },
  { rank: 15, handle: "jonas", pts: 179, days: 11 },
  { rank: 16, handle: "rania", pts: 172, days: 9 },
  { rank: 17, handle: "diego_p", pts: 165, days: 8 },
  { rank: 18, handle: "aisha", pts: 158, days: 8 },
  { rank: 19, handle: "ben.w", pts: 150, days: 7 },
  { rank: 20, handle: "zanele", pts: 144, days: 6 },
  { rank: 21, handle: "arjun", pts: 137, days: 6 },
  { rank: 22, handle: "clara_v", pts: 129, days: 5 },
  { rank: 23, handle: "ifeoma", pts: 122, days: 5 },
  { rank: 24, handle: "leo.k", pts: 114, days: 4 },
  { rank: 25, handle: "noor", pts: 108, days: 4 },
  { rank: 26, handle: "santi", pts: 101, days: 3 },
  { rank: 27, handle: "grace.o", pts: 94, days: 3 },
  { rank: 28, handle: "haruto", pts: 86, days: 2 },
  { rank: 29, handle: "elif", pts: 79, days: 2 },
  { rank: 30, handle: "malik_d", pts: 71, days: 1 },
];

/* TOTAL board — never resets, so it rewards tenure */
const TOTAL_TOP = [
  { rank: 1, handle: "kenji_w", pts: 41280, tier: 5, seasons: 14 },
  { rank: 2, handle: "amara_k", pts: 38940, tier: 5, seasons: 12 },
  { rank: 3, handle: "svetlana", pts: 36110, tier: 5, seasons: 11 },
  { rank: 4, handle: "obi.n", pts: 33470, tier: 5, seasons: 9 },
  { rank: 5, handle: "marta_c", pts: 30820, tier: 4, seasons: 10 },
];

const TOTAL_NEAR = [
  { rank: 4316, handle: "hana_s", pts: 9268, tier: 4, seasons: 3 },
  { rank: 4317, handle: "tomiwa", pts: 9226, tier: 5, seasons: 2 },
  { rank: 4318, handle: "dionj", pts: 9214, tier: 5, seasons: 4, me: true },
  { rank: 4319, handle: "priya", pts: 9188, tier: 3, seasons: 5 },
  { rank: 4320, handle: "ben.w", pts: 9140, tier: 4, seasons: 2 },
];

const TIER_PTS: Record<string, number> = { Spark: 1, Warming: 2, Hot: 3, "Red-hot": 4, Ultimate: 5 };
const TIER_RANGE: Record<string, string> = {
  Spark: "days 1–4",
  Warming: "days 5–8",
  Hot: "days 9–12",
  "Red-hot": "days 13–16",
  Ultimate: "day 17+",
};

type Scope = "General" | "Regional" | "Total";
const SCOPES: Scope[] = ["General", "Regional", "Total"];

export default function Home() {
  const router = useRouter();
  /* No dev controls on this screen. The Pro flip used to live down in the
     corner AND in Profile's dev panel — two buttons doing the same job is one
     more than needed, and the duplicate is the one that goes stale. */
  const { T, freeLocked, plan, profile, streakDays, tabResetKey, userId, refreshStreak } = useApp();
  const [scope, setScope] = useState<Scope>("General");

  const [heroOpen, setHeroOpen] = useState(false);
  const hero = useRef(new Animated.Value(0)).current;

  const [boardMounted, setBoardMounted] = useState(false);
  const [boardBody, setBoardBody] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [crownPlay, setCrownPlay] = useState(0);
  const board = useRef(new Animated.Value(0)).current;

  /* ---------- TODAY'S REAL MEALS ----------
     The whole meal records are kept now, not just per-slot totals — because a
     meal row that can be OPENED needs the meal behind it, and re-fetching on
     tap would put a spinner in front of something the screen already had. */
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [todayMacros, setTodayMacros] = useState({ p: 0, c: 0, f: 0 });
  const [mealsLoaded, setMealsLoaded] = useState(false);

  /* the meal being looked at, and — when a slot holds more than one — the
     list to choose from first */
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [picking, setPicking] = useState<{ slot: string; meals: Meal[] } | null>(null);

  /* ---------- WEIGH-INS ----------
     Read only. Home no longer records a weight — see the note on the chip. */
  const [expectedOpen, setExpectedOpen] = useState(false);
  const [lastKg, setLastKg] = useState<number | null>(null);
  const [lastOn, setLastOn] = useState<string | null>(null);
  const [weighCount, setWeighCount] = useState(0);

  /** today's meals, as one call. Split out of the focus effect so a delete can
      re-run it without the user leaving and coming back. */
  const loadToday = useCallback(async () => {
    if (!userId) { setMealsLoaded(true); return; }

    const { meals } = await loadDay(userId, todayLocal());

    let p = 0, c = 0, f = 0;
    meals.forEach((m) => {
      m.items.forEach((it) => {
        p += it.protein || 0;
        c += it.carbs || 0;
        f += it.fat || 0;
      });
    });

    setTodayMeals(meals);
    setTodayMacros({ p, c, f });
    setMealsLoaded(true);
  }, [userId]);

  /* useFocusEffect rather than useEffect: coming BACK from the camera after
     logging has to show the new number. A mount-only effect wouldn't re-run,
     and the user would see their old total until they restarted the app. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await loadToday();
        if (cancelled) return;
      })();
      return () => { cancelled = true; };
    }, [loadToday])
  );

  /* Refetched on focus, which is what picks up a weigh-in saved over in Stats
     — the user walks back to Home and the sheet's "last weigh-in" is current
     without anything needing to be pushed here. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!userId) return;

      (async () => {
        const { entries } = await loadWeighIns(userId);
        if (cancelled) return;
        setWeighCount(entries.length);

        const newest = entries.length ? entries[entries.length - 1] : null;
        /* THE NUMBER THEY TYPED, not an average of the last three. Averaging
           was built for daily weighers; someone logging every few weeks got a
           figure blended with month-old readings — a weight they hadn't been
           in ages, with nothing on screen explaining why. */
        setLastKg(newest ? newest.weightKg : null);
        setLastOn(newest ? shortDay(newest.measuredOn) : null);
      })();

      return () => { cancelled = true; };
    }, [userId])
  );

  /** after a meal is deleted from the sheet: today's numbers and the streak
      both have to catch up. The streak especially — deleting the only meal of
      the day can end a run, and a flame still burning afterwards would be a
      lie. */
  const afterDelete = useCallback(async () => {
    await loadToday();
    refreshStreak();
  }, [loadToday, refreshStreak]);

  // guards against rapid repeat taps
  const scopeLock = useRef(false);
  const sheetBusy = useRef(false);

  /* tapping the Home tab while already here closes any open sheet */
  const didMount = useRef(false);
  React.useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setHeroOpen(false);
    setBoardMounted(false);
    setBoardBody(false);
    setHowOpen(false);
    setExpectedOpen(false);
    setOpenMeal(null);
    setPicking(null);
  }, [tabResetKey]);

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  // FREE users see the streak in plain green — the day count is the truth and
  // stays visible, but the tier, its colour and the points are the product.
  const flameColor = freeLocked ? T.green : isUlt ? T.orange : tier.color;
  const flameAnim = FLAME_FOR_TIER[tier.name] || "flameSpark";

  /* the slots, each carrying the meals actually logged into it. A slot can
     hold SEVERAL meals — two separate snacks, or a lunch logged twice — which
     is exactly the case the sheet exists to let people fix. */
  const meals = MEAL_SLOTS.map((m) => {
    const mine = todayMeals.filter((t) => (t.mealType || "snacks") === m.key);
    const cal = mine.reduce(
      (sum, t) => sum + t.items.reduce((a, it) => a + (it.calories || 0), 0),
      0
    );
    return { ...m, cal, meals: mine };
  });

  const eaten = meals.reduce((sum, m) => sum + m.cal, 0);
  const nothingLogged = mealsLoaded && eaten === 0;

  /* still stand-in — real steps need HealthKit and a development build */
  const burned = 320;

  /* The base target from your plan, plus what you burned IF you asked for that
     in onboarding. Showing only the sum made the hero look wrong after a
     rebuild — the breakdown below the number is what makes it legible. */
  const base = plan.calories;
  const goal = base + (plan.addBurned ? burned : 0);
  const remaining = Math.max(0, goal - eaten);
  const over = eaten - goal;
  const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;

  /* ---------- THE HERO SENTENCE ----------
     FOUR states, because one template breaks at the edges and two would put
     someone who landed exactly on target in the same bucket as someone 800
     over.

     Every number carries the word CALORIES. A bare figure reads as an
     abstraction, and the whole point is that the user knows what's counted.

     On the OVER wording — the firm version points at the PLAN, not the person.
     "Your goal date moves" is true, specific and something they can act on.
     Anything that reads as disapproval of what they ate is the wrong trade:
     the person having a bad week is exactly the person who most needs to keep
     logging, and an app that makes them feel judged is one they stop opening. */
  let heroLine: string;
  if (nothingLogged) {
    heroLine = `You have ${goal.toLocaleString()} calories to eat today. This number counts down as you log your meals.`;
  } else if (over < 0) {
    heroLine = `You've eaten ${eaten.toLocaleString()} calories so far. That leaves ${remaining.toLocaleString()} calories for the rest of today — it counts down each time you log.`;
  } else if (over <= OVER_THRESHOLD) {
    heroLine = `You've eaten ${eaten.toLocaleString()} calories today, which lands you right on your target of ${goal.toLocaleString()} calories. That's the day done.`;
  } else {
    heroLine = `You've eaten ${eaten.toLocaleString()} calories today — ${over.toLocaleString()} calories above your target of ${goal.toLocaleString()}. A single day like this barely moves the needle, but days like it add up, and your goal date shifts with them.`;
  }

  const nextMeal = meals.find((m) => m.cal === 0);
  const lightMeal = meals.find((m) => m.cal > 0 && m.cal < m.typical * 0.6);

  /* macros come from what was actually eaten, against the plan's targets */
  const macros = [
    { label: "Protein", v: todayMacros.p, t: plan.protein, c: T.green },
    { label: "Carbs", v: todayMacros.c, t: plan.carbs, c: T.gold },
    { label: "Fat", v: todayMacros.f, t: plan.fat, c: T.orange },
  ];

  const openHero = useCallback(() => {
    if (sheetBusy.current) return;
    sheetBusy.current = true;
    setHeroOpen(true);
    Animated.timing(hero, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(() => { sheetBusy.current = false; });
  }, []);

  const closeHero = useCallback(() => {
    if (sheetBusy.current) return;
    sheetBusy.current = true;
    Animated.timing(hero, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => { setHeroOpen(false); sheetBusy.current = false; });
  }, []);

  const openBoard = useCallback(() => {
    if (sheetBusy.current) return;
    sheetBusy.current = true;
    setHowOpen(false);
    setBoardMounted(true);
    setBoardBody(true);
    setCrownPlay((k) => k + 1);
    Animated.timing(board, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(() => { sheetBusy.current = false; });
  }, []);

  const closeBoard = useCallback(() => {
    if (sheetBusy.current) return;
    sheetBusy.current = true;
    setBoardBody(false);
    Animated.timing(board, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => { setBoardMounted(false); setHowOpen(false); sheetBusy.current = false; });
  }, []);

  const pickScope = useCallback((sc: Scope) => {
    setScope((cur) => {
      if (sc === cur || scopeLock.current) return cur;
      scopeLock.current = true;
      setTimeout(() => { scopeLock.current = false; }, 260);
      if (sc === "Total") setCrownPlay((k) => k + 1);
      return sc;
    });
  }, []);

  const heroLift = hero.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const boardLift = board.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  const unit = profile.weightUnit;
  const rate = unit === "kg" ? profile.paceRate : profile.paceRate * 2.20462;
  const losing = profile.targetWeight < profile.startWeight;

  /* ---------- THE WEIGHT CHIP ----------
     READ-ONLY, and always the plan's expected weight. One place to read
     (here) and one place to write (Stats). */
  const startKg = toKg(profile.startWeight || 0, unit as "kg" | "lbs");
  const targetKg = toKg(profile.targetWeight || 0, unit as "kg" | "lbs");
  const paceKg = profile.paceRate || 0.5;

  const signupDate = useMemo(() => {
    if (!profile.memberSince) return new Date();
    const [y, m, d] = String(profile.memberSince).split("-").map(Number);
    return isNaN(y) ? new Date() : new Date(y, m - 1, d);
  }, [profile.memberSince]);

  const expectedKg = expectedKgToday(startKg, targetKg, paceKg, signupDate);
  const expectedShown = fromKg(expectedKg, unit as "kg" | "lbs");
  const lastShown = lastKg != null ? fromKg(lastKg, unit as "kg" | "lbs") : null;

  /* The note states a fact and nothing more. No verdict, because a verdict
     needs the plan to have been re-anchored to a real reading first — that's
     the next piece of work, not this one. */
  const weightNote =
    weighCount === 0
      ? "An estimate until you weigh in · tap to see how it works"
      : lastShown != null && lastOn
        ? `You last weighed ${lastShown.toFixed(1)} ${unit} on ${lastOn}`
        : "Tap to see how this is worked out";

  const s = styles(T);

  /* THE MEAL TRAVELS WITH THE TAP. Tapping "Add snacks" has to open the camera
     already set to Snacks — before this, it opened on whatever was last used,
     so food logged from the Snacks row landed in Dinner. */
  const toCamera = (mealName?: string) =>
    router.push(mealName ? `/(tabs)/camera?meal=${mealName}` : "/(tabs)/camera");

  /** open what's in a slot. One meal opens straight away; several ask which,
      because a slot holding two lunches is exactly the mistake this is for
      and silently opening the first would hide the duplicate. */
  const openSlot = (slot: { name: string; meals: Meal[] }) => {
    if (!slot.meals.length) return;
    if (slot.meals.length === 1) { setOpenMeal(slot.meals[0]); return; }
    setPicking({ slot: slot.name, meals: slot.meals });
  };

  /* the nudge reads the real day. An empty day gets its own line — "1,850
     calories left" is technically true on a blank day but says nothing about
     what to do next. */
  let nudgeTitle: string;
  let nudgeSub: string;
  if (nothingLogged) {
    nudgeTitle = "Nothing logged yet today";
    nudgeSub = "Snap your first meal — it takes about five seconds";
  } else if (over > OVER_THRESHOLD) {
    nudgeTitle = `${over.toLocaleString()} calories over your goal today`;
    nudgeSub = "Keep logging — an honest record is worth more than a tidy one.";
  } else if (nextMeal) {
    nudgeTitle = `${remaining.toLocaleString()} calories left today — log ${nextMeal.name.toLowerCase()}`;
    nudgeSub = "Your next meal · tap to snap, scan or search";
  } else {
    nudgeTitle = "Every meal logged today";
    nudgeSub = `Nice work — that's day ${streakDays} of your streak.`;
  }

  const boardBorder = freeLocked
    ? { color: T.green }
    : isUlt
      ? { colors: ULT_COLORS }
      : { color: tier.color };

  const isTotal = scope === "Total";

  const BoardRow = ({ r }: { r: typeof BOARD_FULL[0] }) => {
    const rt = tierForStreak(r.days);
    const ult = rt.color === "ultimate";
    return (
      <View style={[s.boardRow, r.me && s.boardRowMe]}>
        <Text style={s.boardRank}>{r.rank}</Text>
        {ult ? (
          <View style={{ flex: 1 }}>
            <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
          </View>
        ) : (
          <Text style={[s.boardName, { color: rt.color }]} numberOfLines={1}>@{r.handle}</Text>
        )}
        {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}
        <Text style={s.boardPts}>{r.pts} <Text style={s.boardPtsUnit}>pts</Text></Text>
      </View>
    );
  };

  const TotalRow = ({ r }: { r: typeof TOTAL_TOP[0] & { me?: boolean } }) => {
    const rt = TIERS[r.tier as 1 | 2 | 3 | 4 | 5];
    const ult = rt.color === "ultimate";
    return (
      <View style={[s.totalRow, r.me && s.boardRowMe]}>
        <Text style={s.totalRank}>{r.rank.toLocaleString()}</Text>
        <SeasonCrown color={rt.color} count={r.seasons} size={38} />
        {ult ? (
          <View style={{ flex: 1 }}>
            <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
          </View>
        ) : (
          <Text style={[s.boardName, { color: rt.color }]} numberOfLines={1}>@{r.handle}</Text>
        )}
        {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}
        <Text style={s.boardPts}>{r.pts.toLocaleString()}</Text>
      </View>
    );
  };

  const seasonRows = useMemo(() => BOARD_FULL.map((r) => <BoardRow key={r.rank} r={r} />), [T, streakDays]);
  const totalTopRows = useMemo(() => TOTAL_TOP.map((r) => <TotalRow key={r.rank} r={r} />), [T]);
  const totalNearRows = useMemo(() => TOTAL_NEAR.map((r) => <TotalRow key={r.rank} r={r} />), [T]);
  const seasonPreview = useMemo(() => BOARD_FULL.slice(0, 3).map((r) => <BoardRow key={r.rank} r={r} />), [T, streakDays]);
  const totalPreview = useMemo(() => TOTAL_TOP.slice(0, 3).map((r) => <TotalRow key={r.rank} r={r} />), [T]);

  const CalorieBar = ({ height = 10 }: { height?: number }) => (
    <View style={[s.track, { height }]}>
      {over > 0 ? (
        <View style={[s.fillFlat, { width: `${pct}%`, backgroundColor: over > OVER_THRESHOLD ? T.red : T.orange }]} />
      ) : (
        <LinearGradient
          colors={["#15803D", "#22C55E", "#86EFAC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.fillFlat, { width: `${pct}%` }]}
        />
      )}
    </View>
  );

  const ScopeToggle = ({ big = false }: { big?: boolean }) => (
    <View style={s.scopeToggle}>
      {SCOPES.map((sc) => (
        <Pressable
          key={sc}
          onPress={() => pickScope(sc)}
          style={[s.scopeBtn, big && { paddingHorizontal: 14, paddingVertical: 6 }, scope === sc && { backgroundColor: T.green }]}
        >
          <Text style={[s.scopeText, big && { fontSize: 12 }, scope === sc && { color: T.ink }]}>{sc}</Text>
        </Pressable>
      ))}
    </View>
  );

  const scopeCaption =
    scope === "General"
      ? "Top players worldwide · this season"
      : scope === "Regional"
        ? "Top in your country · this season"
        : "All-time · never resets";

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <PageHeader
          title="Home"
          right={
            <Tap onPress={() => router.push("/(tabs)/profile")}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            </Tap>
          }
        />

        <Text style={s.greeting}>Good evening, {profile.name} · Tue Aug 9</Text>

        {/* CALORIE HERO */}
        <Tap onPress={openHero} style={{ marginTop: 16 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
            <View style={{ padding: 20 }}>
              <View style={s.rowBetween}>
                <Text style={s.micro}>CALORIES LEFT TODAY</Text>
                <ChevronRight size={16} color={T.micro} />
              </View>

              <View style={s.calRow}>
                <Text style={s.calBig}>{remaining.toLocaleString()}</Text>
                <Text style={s.calSub}>of {goal.toLocaleString()} cal</Text>
              </View>

              {/* say which way it moves, and in what unit */}
              <Text style={s.heroExplain}>{heroLine}</Text>

              {plan.addBurned && (
                <Text style={s.goalBreakdown}>
                  {base.toLocaleString()} target + {burned} burned today
                </Text>
              )}

              <CalorieBar />

              <View style={[s.rowBetween, { marginTop: 8 }]}>
                <Text style={s.eatenLine}>{eaten.toLocaleString()} eaten</Text>
                <Text style={s.toGoLine}>{remaining.toLocaleString()} to go</Text>
              </View>

              <Text style={s.tapHint}>Tap for macros</Text>
            </View>
          </TravelBorder>
        </Tap>

        {/* PRIMARY-ACTION NUDGE — carries the next unlogged meal with it */}
        <Tap onPress={() => toCamera(nextMeal?.name)} style={{ marginTop: 14 }}>
          <View style={s.nudge}>
            <View style={s.nudgeIcon}>
              <Icon name="cameraDark" size={24} mode="loop" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nudgeTitle}>{nudgeTitle}</Text>
              <Text style={s.nudgeSub}>{nudgeSub}</Text>
            </View>
            <ChevronRight size={18} color={T.green} />
          </View>
        </Tap>

        {/* TODAY'S MEALS */}
        <Text style={[s.micro, { marginTop: 22, marginBottom: 10 }]}>TODAY'S MEALS</Text>
        {meals.map((m) => {
          const isNext = nextMeal?.name === m.name;
          const isLight = lightMeal?.name === m.name;
          const logged = m.cal > 0;

          /* A LOGGED ROW OPENS; AN EMPTY ONE LOGS. Tapping a logged meal used
             to reopen the camera — which is right for adding, wrong for
             checking, and offered no way at all to fix a mistake. Now the row
             opens what's in it, and a small + still adds more to the same
             meal. */
          return (
            <View key={m.name} style={{ marginBottom: 10 }}>
              <Tap onPress={() => (logged ? openSlot(m) : toCamera(m.name))}>
                <View style={[
                  s.meal,
                  isNext && { borderColor: T.greenBorder, backgroundColor: T.greenBg },
                  isLight && { borderColor: T.goldBorder },
                ]}>
                  <View style={s.mealIcon}>
                    <Icon name={m.icon} size={24} mode="loop" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={s.mealTitleRow}>
                      <Text style={s.mealName}>{m.name}</Text>
                      {isNext && <View style={s.nextTag}><Text style={s.nextTagText}>NEXT</Text></View>}
                      {m.meals.length > 1 && (
                        <View style={s.countTag}>
                          <Text style={s.countTagText}>{m.meals.length} logged</Text>
                        </View>
                      )}
                    </View>
                    {isLight && <Text style={s.lightNote}>Looks light — add anything you missed?</Text>}
                    {logged && !isLight && (
                      <Text style={s.openNote}>Tap to see what's in it</Text>
                    )}
                  </View>

                  {logged ? (
                    <>
                      <Text style={[s.mealCal, isLight && { color: T.gold }]}>{m.cal} cal</Text>
                      {/* adding MORE to a meal that's already logged — the
                          camera route the whole row used to be */}
                      <Pressable
                        onPress={() => toCamera(m.name)}
                        hitSlop={10}
                        style={s.addMore}
                      >
                        <Plus size={15} color={T.green} />
                      </Pressable>
                    </>
                  ) : (
                    <View style={s.addWrap}>
                      <View style={s.addBtn}><Text style={{ color: T.green, fontSize: 15 }}>+</Text></View>
                      <Text style={s.addText}>Add {m.name.toLowerCase()}</Text>
                    </View>
                  )}
                </View>
              </Tap>
            </View>
          );
        })}

        {/* LEADERBOARD */}
        <View style={[s.rowBetween, { marginTop: 24, marginBottom: 10 }]}>
          <Text style={s.micro}>LEADERBOARD</Text>
          <ScopeToggle />
        </View>

        <BlurLock label="Leaderboard" sub="See where you rank with Pro" locked={freeLocked} radius={18}>
          <TravelBorder {...boardBorder} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 14 }}>
              <View style={s.boardHead}>
                <Icon name="trophy" size={17} mode="loop" />
                <Text style={s.boardHeadText}>{scopeCaption}</Text>
              </View>

              {isTotal ? totalPreview : seasonPreview}

              <Tap onPress={openBoard} style={{ marginTop: 6 }}>
                <View style={s.seeFull}>
                  <Text style={s.seeFullText}>See full leaderboard</Text>
                </View>
              </Tap>
            </View>
          </TravelBorder>
        </BlurLock>

        {!freeLocked && (
          <View style={s.boardFoot}>
            <Text style={s.boardFootText}>
              {isTotal
                ? "Every season's points added up. This board never resets."
                : "Points come from logging streaks and tiers — nothing else."}
            </Text>
          </View>
        )}

        {/* SECONDARY chips */}
        <View style={s.strip}>
          <Tap onPress={() => router.push("/(tabs)/calendar")} style={{ flex: 1 }}>
            <View style={s.chipCard}>
              <View style={s.rowBetween}>
                <Text style={s.micro}>STREAK</Text>
                <ChevronRight size={13} color={T.micro} />
              </View>
              <View style={s.wRow}>
                <Text style={s.wBig}>{streakDays}</Text>
                <Text style={s.wUnit}>{streakDays === 1 ? "day" : "days"}</Text>
                <View style={{ marginLeft: "auto" }}>
                  <Icon name={freeLocked ? "flameSpark" : flameAnim} size={20} mode="loop" />
                </View>
              </View>

              {freeLocked ? (
                <Text style={[s.chipNote, { color: T.green }]}>Streak running · unlock tiers</Text>
              ) : isUlt ? (
                <View style={{ marginTop: 4 }}>
                  <GradientText text="Ultimate · +5 pts today" colors={ULT_COLORS} fontSize={9.5} fontFamily={FONTS.headingMed} />
                </View>
              ) : (
                <Text style={[s.chipNote, { color: flameColor }]}>
                  {tier.name} · +{TIER_PTS[tier.name] || 1} pts today
                </Text>
              )}
            </View>
          </Tap>

          {/* THE WEIGHT CHIP — opens an explainer, never a weigh-in. */}
          <View style={{ flex: 1 }}>
            <BlurLock label="Your weight" locked={freeLocked} radius={14} compact>
              <Tap onPress={() => setExpectedOpen(true)}>
                <View style={s.chipCard}>
                  <View style={s.rowBetween}>
                    <Text style={s.micro}>EXPECTED WEIGHT</Text>
                    <ChevronRight size={13} color={T.micro} />
                  </View>
                  <View style={s.wRow}>
                    <Text style={s.wBig}>{expectedShown ? expectedShown.toFixed(1) : "—"}</Text>
                    <Text style={s.wUnit}>{unit}</Text>
                    <Text style={s.wTrend}>{losing ? "↓" : "↑"} {rate.toFixed(1)}</Text>
                  </View>
                  <Text style={s.chipNote} numberOfLines={2}>{weightNote}</Text>
                </View>
              </Tap>
            </BlurLock>
          </View>
        </View>
      </ScrollView>

      {/* ---------- ONE MEAL, OPENED ----------
          The same sheet the calendar uses. This is where a double-logged lunch
          gets fixed — thirty seconds after it happened, without the user
          needing to know a calendar exists. */}
      <MealSheet
        visible={!!openMeal}
        meal={openMeal}
        goalCalories={goal}
        onClose={() => setOpenMeal(null)}
        onDeleted={afterDelete}
      />

      {/* WHICH ONE. Only appears when a slot holds more than one meal — which
          is itself the signal that something may have been logged twice. */}
      <Modal visible={!!picking} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <View style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setPicking(null)} />
          <View style={s.pickCentre} pointerEvents="box-none">
            <View style={s.pickCard}>
              <View style={s.pickHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickLabel}>{picking?.slot}</Text>
                  <Text style={s.pickTitle}>
                    {picking?.meals.length} meals logged
                  </Text>
                </View>
                <Pressable onPress={() => setPicking(null)} hitSlop={12} style={s.pickClose}>
                  <X size={17} color={T.sub} />
                </Pressable>
              </View>

              <Text style={s.pickBody}>
                Which one would you like to look at? If one of these was logged by mistake, you can
                delete it from inside.
              </Text>

              {picking?.meals.map((m, i) => {
                const cal = m.items.reduce((a, it) => a + (it.calories || 0), 0);
                return (
                  <Tap
                    key={m.id || i}
                    onPress={() => { const meal = m; setPicking(null); setTimeout(() => setOpenMeal(meal), 180); }}
                    style={{ marginTop: 9 }}
                  >
                    <View style={s.pickRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.pickRowName} numberOfLines={1}>
                          {m.items.map((it) => it.foodName).join(", ") || "Logged meal"}
                        </Text>
                        <Text style={s.pickRowSub}>
                          {m.items.length} {m.items.length === 1 ? "item" : "items"}
                        </Text>
                      </View>
                      <Text style={s.pickRowCal}>{cal} cal</Text>
                      <ChevronRight size={16} color={T.micro} />
                    </View>
                  </Tap>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* THE EXPLAINER — reads only. Its button hands off to the weight screen
          in Stats, which is the single place a real weight is recorded. */}
      <ExpectedWeightSheet
        T={T}
        visible={expectedOpen}
        onClose={() => setExpectedOpen(false)}
        onGoLog={() => router.push("/(tabs)/stats?view=weight")}
        expectedShown={expectedShown}
        unit={unit as "kg" | "lbs"}
        losing={losing}
        paceShown={rate}
        targetShown={profile.targetWeight || 0}
        lastShown={lastShown}
        lastOn={lastOn}
      />

      {/* CALORIE DETAIL POP-OUT */}
      <Modal visible={heroOpen} transparent animationType="none" onRequestClose={closeHero}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[s.backdrop, { opacity: hero }]}>
            <Pressable style={{ flex: 1 }} onPress={closeHero} />
          </Animated.View>

          <View style={s.sheetCentre} pointerEvents="box-none">
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 380,
                opacity: hero,
                transform: [{ translateY: heroLift }],
              }}
            >
              <TravelBorder color={T.green} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
                <View style={{ height: HERO_H }}>
                  <View style={s.sheetHead}>
                    <View style={{ width: 34 }} />
                    <Text style={s.sheetTitle}>Today</Text>
                    <Pressable onPress={closeHero} hitSlop={14} style={s.sheetClose}>
                      <X size={18} color={T.sub} />
                    </Pressable>
                  </View>

                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[s.micro, { marginTop: 4 }]}>CALORIES LEFT TODAY</Text>
                    <View style={s.calRow}>
                      <Text style={s.calBig}>{remaining.toLocaleString()}</Text>
                      <Text style={s.calSub}>of {goal.toLocaleString()} cal</Text>
                    </View>

                    <Text style={s.heroExplain}>{heroLine}</Text>

                    {plan.addBurned && (
                      <Text style={s.goalBreakdown}>
                        {base.toLocaleString()} target + {burned} burned today
                      </Text>
                    )}

                    <CalorieBar height={12} />

                    <View style={[s.rowBetween, { marginTop: 8, marginBottom: 20 }]}>
                      <Text style={s.eatenLine}>{eaten.toLocaleString()} eaten</Text>
                      <Text style={s.toGoLine}>{remaining.toLocaleString()} to go</Text>
                    </View>

                    {macros.map((m) => (
                      <View key={m.label} style={{ marginBottom: 13 }}>
                        <View style={s.rowBetween}>
                          <Text style={s.macroLabel}>{m.label.toUpperCase()}</Text>
                          <Text style={s.macroLabel}>{m.v}/{m.t}g</Text>
                        </View>
                        <View style={s.macroTrack}>
                          <View style={[s.macroFill, { width: `${m.t > 0 ? Math.min(100, (m.v / m.t) * 100) : 0}%`, backgroundColor: m.c }]}>
                            <Text style={s.macroInside}>{m.v}g</Text>
                          </View>
                        </View>
                      </View>
                    ))}

                    <View style={s.statsRow}>
                      {[["Eaten", eaten.toLocaleString()], ["Burned", burned.toLocaleString()], ["Goal", goal.toLocaleString()]].map(([l, v]) => (
                        <View key={l} style={{ alignItems: "center" }}>
                          <Text style={s.statNum}>{v}</Text>
                          <Text style={s.statLabel}>{l.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>

                    {plan.addBurned && (
                      <Text style={s.burnedNote}>
                        You asked MOTION to add burned calories back, so training days give you more to
                        eat. Turn it off in Profile → Goals.
                      </Text>
                    )}
                  </ScrollView>

                  <View style={s.sheetFooter}>
                    <Tap onPress={() => { closeHero(); setTimeout(() => toCamera(nextMeal?.name), 220); }}>
                      <View style={s.sheetCta}>
                        <Text style={s.sheetCtaText}>Log a meal</Text>
                      </View>
                    </Tap>
                  </View>
                </View>
              </TravelBorder>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* LEADERBOARD POP-OUT */}
      <Modal visible={boardMounted} transparent animationType="none" onRequestClose={closeBoard}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[s.backdrop, { opacity: board }]}>
            <Pressable style={{ flex: 1 }} onPress={closeBoard} />
          </Animated.View>

          <View style={s.sheetCentre} pointerEvents="box-none">
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 380,
                opacity: board,
                transform: [{ translateY: boardLift }],
              }}
            >
              <TravelBorder {...boardBorder} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
                <View style={{ height: SHEET_H }}>

                  <View style={s.sheetHead}>
                    {howOpen ? (
                      <Pressable onPress={() => setHowOpen(false)} hitSlop={14} style={s.sheetBack}>
                        <ChevronLeft size={18} color={T.text} />
                      </Pressable>
                    ) : (
                      <View style={{ width: 34 }} />
                    )}
                    <Text style={s.sheetTitle}>{howOpen ? "How points work" : "Leaderboard"}</Text>
                    <Pressable onPress={closeBoard} hitSlop={14} style={s.sheetClose}>
                      <X size={18} color={T.sub} />
                    </Pressable>
                  </View>

                  {!boardBody ? null : howOpen ? (
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 22 }}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={s.howText}>
                        Every day you log a meal, you earn points. That's the whole game — show up, log,
                        and your score goes up.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        How much a day is worth depends on your streak tier. The longer you keep your
                        streak alive, the higher your tier climbs, and the more each day earns:
                      </Text>

                      <View style={s.tierTable}>
                        {(["Spark", "Warming", "Hot", "Red-hot", "Ultimate"] as const).map((name, i) => {
                          const tt = TIERS[(i + 1) as 1 | 2 | 3 | 4 | 5];
                          const swatch = tt.color === "ultimate" ? "#8B5CF6" : tt.color;
                          const mine = tier.name === name;
                          return (
                            <View key={name} style={[s.tierRow, mine && s.tierRowMine]}>
                              <View style={[s.tierDot, { backgroundColor: swatch }]} />
                              <Text style={[s.tierName, mine && { color: T.text }]}>{name}</Text>
                              <Text style={s.tierRange}>{TIER_RANGE[name]}</Text>
                              <Text style={[s.tierPts, mine && { color: T.green }]}>+{TIER_PTS[name]}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <Text style={[s.howText, { marginTop: 12 }]}>
                        A day at Ultimate is worth five days at Spark. Two people logging the same number
                        of days can end up far apart — consistency is what separates them.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        Miss a day and your streak eases back a tier rather than resetting to zero, so one
                        bad day doesn't undo weeks of work. Pick it up again and you climb straight back.
                      </Text>

                      <View style={s.howDivider} />

                      <Text style={s.howSmallTitle}>The three boards</Text>
                      <Text style={s.howText}>
                        <Text style={s.howBold}>General</Text> and <Text style={s.howBold}>Regional</Text>{" "}
                        reset every season, so everyone starts level and a newcomer can reach the top.
                        Regional narrows it to your country, which is usually where you'll place highest.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        <Text style={s.howBold}>Total</Text> never resets — it adds up every season you've
                        ever played. It rewards sticking around, so people who joined early sit high on it.
                        Your crown there shows the tier you've finished seasons at, and the number is how
                        many times. Finish higher and the crown changes colour, starting the count again.
                      </Text>

                      <View style={s.howDivider} />

                      <Text style={s.howSmallTitle}>What doesn't count</Text>
                      <Text style={s.howText}>
                        Nothing you can buy. Your plan, what you paid, how long you've had the app — none
                        of it affects your rank. Points come from logging and streaks only, so everyone
                        climbs the same ladder.
                      </Text>
                    </ScrollView>
                  ) : (
                    <>
                      <View style={s.sheetScopeRow}>
                        <ScopeToggle big />
                      </View>

                      <Text style={s.sheetSub}>{scopeCaption}</Text>

                      <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews
                      >
                        {isTotal ? (
                          <>
                            <View style={s.badgeStage}>
                              <SeasonCrown
                                color={isUlt ? "ultimate" : tier.color}
                                count={4}
                                size={92}
                                sequence
                                playKey={crownPlay}
                              />
                              <Text style={s.badgeCaption}>4 seasons finished at {tier.name}</Text>
                            </View>

                            {totalTopRows}

                            <View style={s.gapRow}>
                              <View style={s.gapLine} />
                              <Text style={s.gapText}>your position</Text>
                              <View style={s.gapLine} />
                            </View>

                            {totalNearRows}

                            <Text style={s.chaseText}>
                              12 points behind @tomiwa. That's three days at Ultimate.
                            </Text>
                          </>
                        ) : (
                          seasonRows
                        )}
                      </ScrollView>

                      <View style={s.howFooter}>
                        <Tap onPress={() => setHowOpen(true)}>
                          <View style={s.howRow}>
                            <View style={s.howIcon}>
                              <HelpCircle size={16} color={T.green} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.howRowTitle}>How points work</Text>
                              <Text style={s.howRowSub}>Tap to see how ranking is decided</Text>
                            </View>
                            <ChevronRight size={17} color={T.micro} />
                          </View>
                        </Tap>
                      </View>
                    </>
                  )}
                </View>
              </TravelBorder>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    greeting: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, textAlign: "center" },
    avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    avatarText: { color: T.green, fontSize: 12, fontFamily: FONTS.headingMed },

    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

    calRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
    calBig: { fontSize: 46, color: T.text, fontFamily: FONTS.heading },
    calSub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
    heroExplain: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 8, lineHeight: 17 },
    goalBreakdown: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 6 },
    track: { marginTop: 14, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
    fillFlat: { height: "100%", borderRadius: 99 },
    eatenLine: { fontSize: 11, color: T.green, fontFamily: FONTS.headingMed },
    toGoLine: { fontSize: 11, color: T.sub, fontFamily: FONTS.headingMed },
    tapHint: { fontSize: 10, color: T.micro, marginTop: 10, textAlign: "center", fontFamily: FONTS.body },

    macroLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginBottom: 4 },
    macroTrack: { height: 20, borderRadius: 7, backgroundColor: T.track, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: 7, justifyContent: "center", alignItems: "flex-end", minWidth: 30, paddingRight: 7 },
    macroInside: { fontSize: 10.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
    statNum: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    statLabel: { fontSize: 9, color: T.micro, marginTop: 2, fontFamily: FONTS.body, letterSpacing: 0.6 },
    burnedNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 14, lineHeight: 15.5, textAlign: "center" },

    sheetFooter: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: T.border },
    sheetCta: { backgroundColor: T.green, borderRadius: 14, padding: 14, alignItems: "center" },
    sheetCtaText: { color: T.ink, fontFamily: FONTS.headingMed, fontSize: 14 },

    nudge: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 16, padding: 14,
    },
    nudgeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
    nudgeTitle: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    nudgeSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    meal: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
    mealIcon: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    mealTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    mealName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    nextTag: { backgroundColor: T.green, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    nextTagText: { fontSize: 8.5, color: T.ink, fontFamily: FONTS.heading, letterSpacing: 0.6 },
    countTag: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    countTagText: { fontSize: 8.5, color: T.sub, fontFamily: FONTS.body },
    lightNote: { fontSize: 11, color: T.gold, fontFamily: FONTS.body, marginTop: 4 },
    openNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 4 },
    mealCal: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },
    addMore: {
      width: 30, height: 30, borderRadius: 10, marginLeft: 8,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    addWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    addBtn: { width: 20, height: 20, borderRadius: 7, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
    addText: { color: T.sub, fontSize: 12, fontFamily: FONTS.body },

    scopeToggle: { flexDirection: "row", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 2 },
    scopeBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
    scopeText: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed },

    boardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    boardHeadText: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },
    boardRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6 },
    boardRowMe: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder },
    boardRank: { width: 22, fontSize: 14, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    boardName: { flex: 1, fontSize: 13, fontFamily: FONTS.headingMed },
    youChip: { backgroundColor: T.greenBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    youChipText: { fontSize: 9, color: T.green, fontFamily: FONTS.heading },
    boardPts: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },
    boardPtsUnit: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },
    seeFull: { alignItems: "center", paddingVertical: 9, borderRadius: 11, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    seeFullText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
    boardFoot: { marginTop: 10, paddingHorizontal: 4 },
    boardFootText: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15 },

    totalRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 12, marginBottom: 6 },
    totalRank: { width: 34, fontSize: 12, color: T.sub, fontFamily: FONTS.heading, textAlign: "center" },
    badgeStage: { alignItems: "center", paddingTop: 4, paddingBottom: 10 },
    badgeCaption: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    gapRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 },
    gapLine: { flex: 1, height: 1, backgroundColor: T.border },
    gapText: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, letterSpacing: 0.6 },
    chaseText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed, textAlign: "center", marginTop: 8 },

    strip: { flexDirection: "row", gap: 10, marginTop: 16 },
    chipCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13, minHeight: 92 },
    wRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    wBig: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    wUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    wTrend: { marginLeft: "auto", color: T.green, fontSize: 10, fontFamily: FONTS.headingMed },
    chipNote: { fontSize: 9.5, color: T.sub, marginTop: 4, fontFamily: FONTS.body, lineHeight: 13 },

    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    sheetCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
    sheetTitle: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading, letterSpacing: 0.3 },
    sheetBack: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    sheetClose: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    sheetScopeRow: { alignItems: "center", paddingBottom: 8 },
    sheetSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginBottom: 8 },

    /* which meal in this slot */
    pickCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    pickCard: {
      width: "100%", maxWidth: 360,
      backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
      borderRadius: 20, padding: 18,
    },
    pickHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    pickLabel: { fontSize: 9.5, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    pickTitle: { fontSize: 17, color: T.text, fontFamily: FONTS.heading, marginTop: 3 },
    pickClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    pickBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18 },
    pickRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13, padding: 13,
    },
    pickRowName: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    pickRowSub: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },
    pickRowCal: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },

    howFooter: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: T.border },
    howRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13 },
    howIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
    howRowTitle: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    howRowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    howSmallTitle: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 6 },
    howText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },
    howBold: { color: T.text, fontFamily: FONTS.headingMed },
    howDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

    tierTable: { marginTop: 11, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, overflow: "hidden" },
    tierRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingHorizontal: 11 },
    tierRowMine: { backgroundColor: T.greenBg },
    tierDot: { width: 9, height: 9, borderRadius: 3 },
    tierName: { width: 62, fontSize: 11.5, color: T.sub, fontFamily: FONTS.headingMed },
    tierRange: { flex: 1, fontSize: 10.5, color: T.micro, fontFamily: FONTS.body },
    tierPts: { fontSize: 12, color: T.sub, fontFamily: FONTS.heading },
  });