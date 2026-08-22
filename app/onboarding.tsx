// app/onboarding.tsx
// Fifteen screens, down from twenty-eight.
//
// WHY THE CUT. Onboarding is the only screen every single user meets before
// they've decided whether they like the app — a long one is where people
// quietly leave. Dion's friend called it too long, and the audit agreed:
//
//   FOUR SCREENS ASKED THINGS NOTHING READ. "Have you tried other calorie
//   apps", "do you work with a trainer", "what would you like to accomplish"
//   and the referral code were all collected and then dropped before finish().
//
//   TWO SCREENS ASKED THE SAME QUESTION. Workouts-per-week and how-active-are-
//   you both fed the same multiplier. The DAY-TO-DAY question survives: it
//   drives the base multiplier (1.2 → 1.725, most of the range) while workouts
//   only added a bump of up to 0.1.
//
//   THE 2× HISTOGRAM made a claim we'd have to defend, and "MOTION is built
//   around you" was assembled from two of the deleted screens.
//
//   GOAL DATE AND THE GRAPH MERGED. Same information twice.
//
//   DIET AND BURNED CALORIES MOVED TO PROFILE.
//
// ⚠️ NO FULL-SCREEN TAP-TO-DISMISS WRAPPER. One was added and it FROZE THE
// BIRTHDAY WHEEL solid — a TouchableWithoutFeedback covering the screen claims
// the touch before any ScrollView inside it can, and the outer handler always
// wins. Tapping the background already dismisses the keyboard on its own:
// that's what keyboardShouldPersistTaps="handled" does. The wrapper was
// solving a problem that didn't exist and created a real one.
import { useRouter } from "expo-router";
import { AlertTriangle, Check, ChevronLeft, Crown, Eye, EyeOff, Sparkles } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path, Line as SvgLine, Text as SvgText } from "react-native-svg";
import Icon, { IconName } from "../components/Icon";
import IsoM, { IsoMGlow } from "../components/IsoM";
import TravelBorder from "../components/TravelBorder";
import { useApp } from "../constants/AppState";
import { signIn, signUp } from "../constants/auth";
import { DARK, FONTS } from "../constants/theme";

const T = DARK;

type Choice = {
  key: string;
  label: string;
  sub?: string;
  icon?: IconName;
};

type Step =
  | { kind: "welcome"; id: string }
  | { kind: "about"; id: string }
  | { kind: "body"; id: string }
  | { kind: "single"; id: string; title: string; sub?: string; choices: Choice[] }
  | { kind: "desired"; id: string; title: string; sub?: string }
  | { kind: "outlook"; id: string }
  | { kind: "health"; id: string }
  | { kind: "notifications"; id: string }
  | { kind: "building"; id: string; title: string; sub?: string }
  | { kind: "plan"; id: string }
  | { kind: "signin"; id: string }
  | { kind: "paywall"; id: string }
  | { kind: "heard"; id: string };

const STEPS: Step[] = [
  { kind: "welcome", id: "welcome" },

  /* SEX AND BIRTHDAY TOGETHER. Two quick answers that don't each need a
     screen — and both feed the same BMR formula. */
  { kind: "about", id: "about" },

  /* HEIGHT AND WEIGHT TOGETHER, same reasoning */
  { kind: "body", id: "body" },

  { kind: "single", id: "goal", title: "What's your goal?", sub: "We'll shape your whole plan around this — you can change it anytime.", choices: [
    { key: "lose", label: "Lose weight", icon: "goalChartDown" },
    { key: "maintain", label: "Maintain", icon: "goalFlat" },
    { key: "gain", label: "Gain weight", icon: "goalChartUp" },
  ]},

  { kind: "desired", id: "desired", title: "What's your desired weight?", sub: "Pick a target that feels realistic — you can change it later." },

  { kind: "single", id: "activity", title: "How active are you?", sub: "Day to day, counting work and everything else — not just the gym.", choices: [
    { key: "low", label: "Mostly sitting", sub: "Desk job, little exercise" },
    { key: "light", label: "Lightly active", sub: "On your feet some of the day, or 1–3 workouts a week" },
    { key: "mod", label: "Moderately active", sub: "Moving most of the day, or 3–5 workouts a week" },
    { key: "high", label: "Very active", sub: "Physical job, or training 6–7 days a week" },
  ]},

  { kind: "single", id: "pace", title: "How fast do you want to go?", sub: "You can change this anytime.", choices: [
    { key: "slow", label: "Steady", sub: "Slow & sustainable · 0.25 kg a week" },
    { key: "mod", label: "Balanced", sub: "Our recommendation · 0.5 kg a week" },
    { key: "fast", label: "Aggressive", sub: "Faster results · 0.75 kg a week" },
  ]},

  { kind: "outlook", id: "outlook" },

  { kind: "health", id: "health" },
  { kind: "notifications", id: "notifications" },

  { kind: "building", id: "building", title: "Building your plan", sub: "Motion is crunching your numbers…" },
  { kind: "plan", id: "plan" },
  { kind: "signin", id: "signin" },
  { kind: "paywall", id: "paywall" },

  /* LAST, DELIBERATELY. Useless to the user, valuable to Dion once he's paying
     for ads — so it goes AFTER the paywall, where it can't delay anyone
     reaching the app they just signed up for. */
  { kind: "heard", id: "heard" },
];

const LANGUAGES = [
  "English", "Español", "Français", "Deutsch", "Italiano", "Português",
  "Nederlands", "Polski", "Türkçe", "Русский", "العربية", "हिन्दी",
  "中文", "日本語", "한국어",
];

const PACE_RATE: Record<string, number> = { slow: 0.25, mod: 0.5, fast: 0.75 };

const HEARD_CHOICES: Choice[] = [
  { key: "tiktok", label: "TikTok", icon: "tiktok" },
  { key: "instagram", label: "Instagram", icon: "instagram" },
  { key: "youtube", label: "YouTube", icon: "youtube" },
  { key: "x", label: "X", icon: "xTwitter" },
  { key: "facebook", label: "Facebook", icon: "facebook" },
  { key: "google", label: "Google", icon: "google" },
  { key: "appstore", label: "App Store", icon: "appStore" },
  { key: "tv", label: "TV", icon: "tv" },
  { key: "friends", label: "Friends / Family", icon: "friendsFamily" },
  { key: "other", label: "Other", icon: "otherDots" },
];

/* ---------- WHERE THEY ARE ----------
   Read from the device, never asked — it's what the Regional leaderboard
   groups on, and asking a question the phone can already answer is exactly
   the kind of screen this pass exists to remove.

   ⚠️ NO EXTRA PACKAGE, and that's deliberate. expo-localization is the obvious
   tool and it FAILED here: it ships a native module, and a native module only
   exists in the app after a full EAS rebuild. Installing it gave
   "Cannot find native module 'ExpoLocalization'" and the whole app refused to
   start — and uninstalling left an orphan entry in app.json that broke it
   again.

   THE GENERAL RULE: any package with a native part needs a new dev build
   before it works at all. Installing it is only half the job. */
function deviceRegion(): string | null {
  try {
    const raw =
      Platform.OS === "ios"
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;

    if (!raw) return null;

    /* "en_CA" → CA, "en-GB" → GB */
    const parts = String(raw).replace("-", "_").split("_");
    const code = parts.length > 1 ? parts[1] : null;

    return code && code.length === 2 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

/* ===================== THE PLAN CALCULATION =====================
   The NUMBER comes from a formula (Mifflin-St Jeor + activity factor),
   not from the AI — same inputs always give the same target, and it's
   clinically grounded. Motion supplies the coaching around it. */
function buildPlan(a: Record<string, any>) {
  const wUnit = a.body?.wUnit || "kg";
  const wRaw = parseFloat(a.body?.weight) || 75;
  const kg = wUnit === "kg" ? wRaw : wRaw / 2.20462;

  let cm = 175;
  if (a.body?.hUnit === "cm") {
    cm = parseFloat(a.body.cm) || 175;
  } else if (a.body) {
    const ft = parseFloat(a.body.ft) || 5;
    const inch = parseFloat(a.body.inch) || 0;
    cm = (ft * 12 + inch) * 2.54;
  }

  let age = 28;
  if (a.about?.birthday) {
    const b = a.about.birthday;
    const now = new Date();
    age = now.getFullYear() - b.y;
    const had = now.getMonth() > b.m || (now.getMonth() === b.m && now.getDate() >= b.d);
    if (!had) age -= 1;
  }

  const sex = a.about?.sex || "male";

  const bmr = sex === "female"
    ? 10 * kg + 6.25 * cm - 5 * age - 161
    : 10 * kg + 6.25 * cm - 5 * age + 5;

  /* ONE MULTIPLIER, from one question. The old flow added a second bump from
     workouts-per-week on top of this — both questions asking the same thing,
     which is why one of them went. */
  const base: Record<string, number> = { low: 1.2, light: 1.375, mod: 1.55, high: 1.725 };
  const mult = base[a.activity] || 1.375;
  const tdee = bmr * mult;

  const rate = PACE_RATE[a.pace] || 0.5;
  const dailyShift = (rate * 7700) / 7;
  let target = tdee;
  if (a.goal === "lose") target = tdee - dailyShift;
  if (a.goal === "gain") target = tdee + dailyShift;

  const floor = sex === "female" ? 1200 : 1500;
  target = Math.max(floor, target);
  const hitFloor = target === floor && a.goal === "lose";

  const calories = Math.round(target / 10) * 10;
  const protein = Math.round(kg * 1.8);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat, tdee: Math.round(tdee), hitFloor, kg, cm: Math.round(cm) };
}

function goalTimeline(a: Record<string, any>) {
  const unit = a.body?.wUnit || "kg";
  const cur = parseFloat(a.body?.weight) || 0;
  const target = parseFloat(a.desired?.val) || cur;
  const rateKg = PACE_RATE[a.pace] || 0.5;
  const rate = unit === "kg" ? rateKg : rateKg * 2.20462;
  const diff = Math.abs(cur - target);
  const weeks = rate > 0 ? Math.max(1, Math.ceil(diff / rate)) : 1;
  return { unit, cur, target, rate, diff, weeks, losing: target < cur, maintaining: diff < 0.05 };
}

/* ===================== SLIDE + FADE TRANSITION ===================== */
function StepTransition({ stepKey, dir, children }: { stepKey: string; dir: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.bezier(0.22, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [stepKey]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [34 * dir, 0] });
  return <Animated.View style={{ flex: 1, opacity: anim, transform: [{ translateX }] }}>{children}</Animated.View>;
}

export default function Onboarding() {
  const router = useRouter();
  const { setIsPro, savePlan } = useApp();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  /* set by AccountStep once a NEW account exists. finish() needs it to write
     the profile row — no account, nowhere to attach the plan. */
  const [userId, setUserId] = useState<string | null>(null);

  /* read ONCE, at the start. The phone's region doesn't change mid-signup. */
  const region = useMemo(() => deviceRegion(), []);

  const step = STEPS[i];
  const total = STEPS.length;

  /* MOVING ON ALWAYS CLOSES THE KEYBOARD. Without this it can survive the
     transition and hang over the next screen, which looks like the app has
     lost track of itself. */
  const goNext = () => {
    Keyboard.dismiss();
    if (i < total - 1) { setDir(1); setI(i + 1); }
    else finish(false);
  };
  const goBack = () => {
    Keyboard.dismiss();
    if (i > 0) { setDir(-1); setI(i - 1); }
  };

  /* remembered from the paywall so the LAST screen doesn't have to know about
     it — the attribution question comes after the decision, but the decision
     is what finish() needs. */
  const proChoice = useRef(false);

  const finish = (pro: boolean) => {
    const p = buildPlan(answers);
    const tl = goalTimeline(answers);
    const b = answers.about?.birthday || { d: 12, m: 2, y: 2001 };

    savePlan(
      {
        calories: p.calories,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        tdee: p.tdee,
        /* OFF BY DEFAULT now that onboarding doesn't ask. Profile → Daily
           calories turns it on, writing the same flag. */
        addBurned: false,
      },
      {
        name: "Dion",
        /* SEX and HEIGHT are stored because Profile → Goal recomputes BMR from
           the body when you change your goal. The female constant differs by
           166 calories, so guessing isn't an option. */
        sex: (answers.about?.sex || "male") as "male" | "female",
        heightCm: p.cm,
        heightUnit: (answers.body?.hUnit === "cm" ? "cm" : "ft") as "cm" | "ft",
        dobDay: b.d,
        dobMonth: b.m,
        dobYear: b.y,
        goal: (answers.goal || "lose") as "lose" | "maintain" | "gain",
        weightUnit: (tl.unit || "kg") as "kg" | "lbs",
        startWeight: tl.cur,
        targetWeight: tl.target,
        paceRate: PACE_RATE[answers.pace] || 0.5,
        goalWeeks: tl.weeks,
        activity: answers.activity,
        region: region || undefined,
        heardFrom: answers.heard,
        isPro: pro,
      } as any,
      /* THE ID MATTERS HERE. AccountStep created the account moments ago and
         AppState's auth listener may not have caught up yet — passing it
         explicitly means the profile write can't miss. */
      userId || undefined
    );
    setIsPro(pro);
    router.replace("/(tabs)");
  };

  /** ---------- THEY SIGNED IN TO AN ACCOUNT THAT ALREADY EXISTS ----------
      STRAIGHT TO THE APP, AND NOTHING IS WRITTEN. This is the whole reason
      the sign-in path is separate from finish().

      Someone who reinstalled the app can easily miss the "Sign in" link on
      the welcome screen, run the whole flow, and reach here. Their answers
      are FRESH GUESSES; the account holds months of real tracking. Doing what
      finish() does would overwrite their true starting weight, target and
      plan with those guesses — destroying their history in the exact moment
      they were trying to recover it.

      So the answers are discarded. AppState's auth listener loads their real
      profile the moment the session appears. */
  const enterExisting = () => {
    router.replace("/(tabs)");
  };

  useEffect(() => {
    if (step.kind === "building") {
      const t = setTimeout(() => { setDir(1); setI((x) => x + 1); }, 2600);
      return () => clearTimeout(t);
    }
  }, [step]);

  const pct = ((i + 1) / total) * 100;
  const set = (id: string, v: any) => setAnswers({ ...answers, [id]: v });

  if (step.kind === "welcome") {
    return (
      <Welcome
        onNext={goNext}
        onSignIn={() => router.replace("/signin")}
        lang={answers.lang || "English"}
        setLang={(l: string) => set("lang", l)}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        {i > 0 && step.kind !== "building" ? (
          <Pressable onPress={goBack} hitSlop={10}><ChevronLeft size={24} color={T.text} /></Pressable>
        ) : <View style={{ width: 24 }} />}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <StepTransition stepKey={step.id} dir={dir}>
        {step.kind === "about" && <AboutStep value={answers.about} onChange={(v: any) => set("about", v)} onNext={goNext} />}
        {step.kind === "body" && <BodyStep value={answers.body} onChange={(v: any) => set("body", v)} onNext={goNext} />}
        {step.kind === "single" && <SingleStep step={step} value={answers[step.id]} onPick={(k: string) => { set(step.id, k); setTimeout(goNext, 180); }} />}
        {step.kind === "desired" && <DesiredStep step={step} value={answers[step.id]} body={answers.body} goal={answers.goal} onChange={(v: any) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "outlook" && <OutlookStep answers={answers} onNext={goNext} />}
        {step.kind === "health" && <HealthStep value={answers.health} onChange={(v: any) => set("health", v)} onNext={goNext} />}
        {step.kind === "notifications" && <NotificationsStep value={answers.notifications} onChange={(v: any) => set("notifications", v)} onNext={goNext} />}
        {step.kind === "plan" && <PlanStep answers={answers} onNext={goNext} />}
        {step.kind === "signin" && <AccountStep onNext={goNext} onAccount={setUserId} onExisting={enterExisting} />}
        {step.kind === "building" && <BuildingStep step={step} />}
        {step.kind === "paywall" && (
          <TrialPaywall
            onStartTrial={() => { proChoice.current = true; goNext(); }}
            onSkip={() => { proChoice.current = false; goNext(); }}
          />
        )}
        {step.kind === "heard" && (
          <HeardStep
            onPick={(k: string) => { set("heard", k); setTimeout(() => finish(proChoice.current), 200); }}
            onSkip={() => finish(proChoice.current)}
          />
        )}
      </StepTransition>
    </KeyboardAvoidingView>
  );
}

/* ===================== WELCOME ===================== */
function Welcome({
  onNext, onSignIn, lang, setLang,
}: {
  onNext: () => void;
  onSignIn: () => void;
  lang: string;
  setLang: (l: string) => void;
}) {
  const [picker, setPicker] = useState(false);
  return (
    <View style={styles.screen}>
      <View style={styles.welcomeTop}>
        <Pressable onPress={() => setPicker(true)} style={styles.langChip} hitSlop={8}>
          {/* the same globe the Region row uses in Profile */}
          <Icon name="region" size={15} mode="loop" />
          <Text style={styles.langText}>{lang}</Text>
        </Pressable>
      </View>

      <View style={styles.welcomeBody}>
        <View style={{ marginBottom: 20 }}>
          <IsoMGlow size={124} />
        </View>
        <Text style={styles.welcomeTitle}>Calorie tracking{"\n"}made easy</Text>
        <Text style={styles.welcomeSub}>
          Snap a photo of your meal and MOTION works out the calories. Build a streak, keep it going.
        </Text>
      </View>

      <View style={styles.welcomeFooter}>
        <Pressable onPress={onNext} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Get started</Text>
        </Pressable>

        {/* returning users cross straight to sign-in — though plenty will miss
            this and run the whole flow anyway, which is why the account screen
            can sign in too */}
        <Pressable onPress={onSignIn} style={{ alignItems: "center", marginTop: 16 }} hitSlop={8}>
          <Text style={styles.signInText}>Already have an account? <Text style={{ color: T.green }}>Sign in</Text></Text>
        </Pressable>
      </View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setPicker(false)}>
          <Pressable style={styles.langCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.langCardTitle}>Choose your language</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((l) => {
                const on = l === lang;
                return (
                  <Pressable key={l} onPress={() => { setLang(l); setPicker(false); }} style={[styles.langRow, on && styles.langRowOn]}>
                    <Text style={[styles.langRowText, on && { color: T.green }]}>{l}</Text>
                    {on && <Check size={16} color={T.green} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ===================== ABOUT YOU — SEX + BIRTHDAY =====================
   Two questions on one screen. Both feed the same BMR formula, both are a
   single tap or a spin, and neither justified a screen of its own.

   ⚠️ THIS SCREEN DOES NOT SCROLL, and that's the fix for a real problem. It
   was a ScrollView out of habit, and the wheel scrolls too — so when a finger
   landed slightly off the wheel, the PAGE moved instead of the dates. Two
   scrollable things fighting over one finger, and the page usually won.

   THE WHEEL WORKS BEFORE THE SEX IS PICKED. Only the Continue button waits on
   that — someone's eye can easily go to the birthday first, and a picker that
   ignores you until you've answered something else feels broken. */
/* 40 rather than 44 — five rows of 44 is 220 points, and with the page no
   longer scrolling that pushed Continue toward the bottom edge on a small
   phone. Four points a row buys back 20 without the wheel feeling cramped. */
const ITEM_H = 40;
/* FIVE ROWS. It was briefly three, to guarantee the button fit — but three
   reads as a cramped little box rather than a date picker. */
const VISIBLE = 5;
const WHEEL_PAD = Math.floor(VISIBLE / 2);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS: number[] = [];
for (let y = 2012; y >= 1940; y--) YEARS.push(y);

function WheelColumn({ data, index, onIndex, width }: { data: string[]; index: number; onIndex: (i: number) => void; width: number }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM_H, animated: false }), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <ScrollView
      ref={ref}
      style={{ width, height: ITEM_H * VISIBLE }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      /* the padding centres the first and last items in the band — it has to
         match WHEEL_PAD or the selected row sits off-centre */
      contentContainerStyle={{ paddingVertical: ITEM_H * WHEEL_PAD }}
      onMomentumScrollEnd={(e) => {
        const raw = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
        onIndex(Math.max(0, Math.min(data.length - 1, raw)));
      }}
    >
      {data.map((label, k) => (
        <View key={k} style={styles.wheelCell}>
          <Text style={[styles.wheelItem, k === index && styles.wheelItemOn]} numberOfLines={1}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function AboutStep({ value, onChange, onNext }: any) {
  const v = value || { sex: null, birthday: { m: 5, d: 14, y: 1998 } };
  const b = v.birthday;

  const setSex = (sex: string) => onChange({ ...v, sex });
  const setBirthday = (patch: any) => {
    const next = { ...b, ...patch };
    const max = new Date(next.y, next.m + 1, 0).getDate();
    if (next.d > max) next.d = max;
    onChange({ ...v, birthday: next });
  };

  const daysInMonth = new Date(b.y, b.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, k) => String(k + 1));

  /* the sex has to be CHOSEN. The wheel has a sensible default and a birthday
     a few years out barely moves the formula, but guessing someone's sex
     wrong is a 166-calorie error and an insult. */
  const ready = !!v.sex;

  return (
    /* a plain View — see the note above about why this screen doesn't scroll */
    <View style={[styles.body, { flex: 1 }]}>
      <Text style={styles.title}>A bit about you</Text>
      <Text style={styles.sub}>Both of these feed the formula that works out how much energy your body needs.</Text>

      <Text style={[styles.micro, { marginTop: 22, marginBottom: 10 }]}>SEX</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { key: "male", label: "Male", icon: "male" as IconName },
          { key: "female", label: "Female", icon: "female" as IconName },
        ].map((c) => {
          const on = v.sex === c.key;
          return (
            <Pressable key={c.key} onPress={() => setSex(c.key)} style={[styles.sexTile, on && styles.choiceOn]}>
              <Icon name={c.icon} size={26} mode="loop" />
              <Text style={[styles.sexLabel, on && { color: T.green }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.micro, { marginTop: 20, marginBottom: 2 }]}>WHEN WERE YOU BORN?</Text>
      {/* SAY THAT IT SCROLLS, and say it in green so it reads as an
          instruction rather than fine print. A wheel looks tappable, and
          someone tapping a month that won't respond has no way to know
          they're meant to drag — they'll assume it's broken. */}
      <Text style={styles.scrollHint}>Scroll each column to set your date</Text>

      <View style={styles.wheelWrap}>
        <View style={styles.wheelBand} pointerEvents="none" />
        <View style={styles.wheelRow}>
          <WheelColumn data={MONTHS} index={b.m} onIndex={(k) => setBirthday({ m: k })} width={124} />
          <WheelColumn data={days} index={Math.min(b.d - 1, daysInMonth - 1)} onIndex={(k) => setBirthday({ d: k + 1 })} width={60} />
          <WheelColumn data={YEARS.map(String)} index={Math.max(0, YEARS.indexOf(b.y))} onIndex={(k) => setBirthday({ y: YEARS[k] })} width={80} />
        </View>
      </View>

      {/* pushes the button to the bottom whatever the phone's height, so it's
          never floating awkwardly mid-screen */}
      <View style={{ flex: 1 }} />

      <Pressable onPress={ready ? onNext : undefined} style={[styles.primaryBtn, !ready && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ready && styles.btnTextDisabled]}>Continue</Text>
      </Pressable>
      {!ready && <Text style={styles.agreeHint}>Pick your sex above to continue.</Text>}
    </View>
  );
}

/* ===================== UNIT TOGGLE ===================== */
function UnitToggle({ options, value, onPick, compact }: { options: string[]; value: string; onPick: (v: string) => void; compact?: boolean }) {
  return (
    <View style={[styles.unitToggle, compact && { marginTop: 0 }]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onPick(o)} style={[styles.unitPill, compact && styles.unitPillSmall, on && styles.unitPillOn]}>
            <Text style={[styles.unitPillText, on && styles.unitPillTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ===================== YOUR BODY — HEIGHT + WEIGHT =====================
   Two number entries on one screen. This one DOES scroll, unlike the birthday
   screen — a keyboard covers half the display, and without scrolling the
   second field would be unreachable. No wheel here to fight over the finger.

   NO returnKeyType ON THE NUMBER FIELDS. It was briefly set to "done", which
   put a bulky Done key on a numeric keypad — not something iOS apps do, and
   it looked wrong. keyboardDismissMode="on-drag" covers it instead: start
   scrolling and the keyboard gets out of the way. */
function BodyStep({ value, onChange, onNext }: any) {
  const v = value || { hUnit: "cm", cm: "", ft: "", inch: "", wUnit: "kg", weight: "" };
  const set = (patch: any) => onChange({ ...v, ...patch });

  /* ---- height ---- */
  const cmNum = parseFloat(v.cm);
  const ftNum = parseFloat(v.ft);
  const inNum = parseFloat(v.inch || "0");

  let hOk = false;
  let hWarn = "";
  if (v.hUnit === "cm") {
    hOk = !isNaN(cmNum) && cmNum >= 90 && cmNum <= 250;
    if (v.cm.length > 0 && !hOk) hWarn = "Enter a height between 90 and 250 cm.";
  } else {
    const totalIn = (isNaN(ftNum) ? 0 : ftNum) * 12 + (isNaN(inNum) ? 0 : inNum);
    hOk = !isNaN(ftNum) && totalIn >= 36 && totalIn <= 98;
    if (v.ft.length > 0 && !hOk) hWarn = "Enter a height between 3'0\" and 8'2\".";
  }

  /* ---- weight ---- */
  const wNum = parseFloat(v.weight);
  const wMin = v.wUnit === "kg" ? 25 : 55;
  const wMax = v.wUnit === "kg" ? 300 : 660;
  const wOk = !isNaN(wNum) && wNum >= wMin && wNum <= wMax;
  const wWarn = v.weight.length > 0 && !wOk
    ? `Expected between ${wMin} and ${wMax} ${v.wUnit}.`
    : "";

  const ready = hOk && wOk;

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Your height and weight</Text>
      <Text style={styles.sub}>Be honest with the weight — it shapes your whole plan, and you can update it any time.</Text>

      {/* ---------- HEIGHT ---------- */}
      <View style={styles.fieldHead}>
        <Text style={styles.micro}>HEIGHT</Text>
        <UnitToggle
          compact
          options={["cm", "ft + in"]}
          value={v.hUnit === "cm" ? "cm" : "ft + in"}
          onPick={(u) => set({ hUnit: u === "cm" ? "cm" : "ft" })}
        />
      </View>

      {v.hUnit === "cm" ? (
        <View style={styles.entryRowTight}>
          <TextInput value={v.cm} onChangeText={(t) => set({ cm: t.replace(/[^0-9.]/g, "") })} keyboardType="number-pad" placeholder="175" placeholderTextColor={T.micro} style={styles.midInput} maxLength={3} />
          <Text style={styles.entryUnit}>cm</Text>
        </View>
      ) : (
        <View style={styles.entryRowTight}>
          <TextInput value={v.ft} onChangeText={(t) => set({ ft: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="5" placeholderTextColor={T.micro} style={[styles.midInput, { minWidth: 58 }]} maxLength={1} />
          <Text style={styles.entryUnit}>ft</Text>
          <TextInput value={v.inch} onChangeText={(t) => set({ inch: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="9" placeholderTextColor={T.micro} style={[styles.midInput, { minWidth: 58, marginLeft: 14 }]} maxLength={2} />
          <Text style={styles.entryUnit}>in</Text>
        </View>
      )}

      {hWarn ? (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.warnText}>{hWarn}</Text>
        </View>
      ) : null}

      {/* ---------- WEIGHT ---------- */}
      <View style={[styles.fieldHead, { marginTop: 30 }]}>
        <Text style={styles.micro}>WEIGHT</Text>
        <UnitToggle compact options={["kg", "lbs"]} value={v.wUnit} onPick={(u) => set({ wUnit: u })} />
      </View>

      <View style={styles.entryRowTight}>
        <TextInput
          value={v.weight}
          onChangeText={(t) => set({ weight: t.replace(/[^0-9.]/g, "") })}
          keyboardType="decimal-pad"
          placeholder={v.wUnit === "kg" ? "78" : "172"}
          placeholderTextColor={T.micro}
          style={styles.midInput}
          maxLength={5}
        />
        <Text style={styles.entryUnit}>{v.wUnit}</Text>
      </View>

      {wWarn ? (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.warnText}>{wWarn}</Text>
        </View>
      ) : null}

      <Pressable onPress={ready ? onNext : undefined} style={[styles.primaryBtn, { marginTop: 30 }, !ready && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ready && styles.btnTextDisabled]}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== DESIRED WEIGHT =====================
   A target that contradicts the stated goal is a HARD BLOCK, not a note —
   letting it through would make the plan, the timeline and the graph all
   disagree with each other. */
function DesiredStep({ step, value, body, goal, onChange, onNext }: any) {
  const unit = body?.wUnit || "kg";
  const cur = parseFloat(body?.weight) || (unit === "kg" ? 78 : 172);
  const v = value || { val: "" };
  const n = parseFloat(v.val);

  const min = unit === "kg" ? 35 : 77;
  const max = unit === "kg" ? 300 : 660;
  const inRange = !isNaN(n) && n >= min && n <= max;

  const change = inRange ? n - cur : 0;
  const pctChange = inRange ? Math.abs(change) / cur : 0;

  const contradictsGain = inRange && goal === "gain" && change <= 0;
  const contradictsLose = inRange && goal === "lose" && change >= 0;
  const contradicts = contradictsGain || contradictsLose;

  const canContinue = inRange && !contradicts;

  let note = "";
  if (v.val.length > 0 && !inRange) {
    note = `Enter a target between ${min} and ${max} ${unit}.`;
  } else if (contradictsGain) {
    note = `You chose to gain weight, so your target has to be above ${cur} ${unit}. Enter a higher number, or go back and change your goal.`;
  } else if (contradictsLose) {
    note = `You chose to lose weight, so your target has to be below ${cur} ${unit}. Enter a lower number, or go back and change your goal.`;
  } else if (inRange && pctChange > 0.25) {
    note = "That's a big change from where you are now. It's doable, but it'll take a while — you can always adjust later.";
  } else if (inRange) {
    note = `That's ${Math.abs(change).toFixed(1)} ${unit} ${change < 0 ? "below" : change > 0 ? "above" : "from"} where you are now — a healthy target.`;
  }

  const noteOk = inRange && !contradicts && pctChange <= 0.25;

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* the bullseye stays — this screen is about aiming at something */}
      <View style={styles.stepHero}><Icon name="targetBullseye" size={46} mode="loop" /></View>

      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}

      <View style={styles.currentChip}>
        <Text style={styles.currentChipText}>
          Right now: {cur} {unit}
          {goal === "lose" ? " · aiming lower" : goal === "gain" ? " · aiming higher" : ""}
        </Text>
      </View>

      <View style={styles.entryRow}>
        <TextInput
          value={v.val}
          onChangeText={(t) => onChange({ val: t.replace(/[^0-9.]/g, "") })}
          keyboardType="decimal-pad"
          placeholder={goal === "gain" ? String(Math.round(cur + (unit === "kg" ? 6 : 13))) : goal === "lose" ? String(Math.round(cur - (unit === "kg" ? 6 : 13))) : String(Math.round(cur))}
          placeholderTextColor={T.micro}
          style={styles.bigInput}
          maxLength={5}
        />
        <Text style={styles.entryUnit}>{unit}</Text>
      </View>

      {note ? (
        <View style={[styles.warnRow, noteOk && styles.noteRowOk]}>
          {noteOk ? <Check size={14} color={T.green} /> : <AlertTriangle size={14} color="#FBBF24" />}
          <Text style={[styles.warnText, noteOk && { color: T.green }]}>{note}</Text>
        </View>
      ) : null}

      <Pressable onPress={canContinue ? onNext : undefined} style={[styles.primaryBtn, { marginTop: 30 }, !canContinue && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !canContinue && styles.btnTextDisabled]}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== THE OUTLOOK — DATE + GRAPH =====================
   These were two screens: one stated the date, the other drew the line to it.
   The same fact told twice, and the second made the first redundant. */
function OutlookStep({ answers, onNext }: any) {
  const { unit, cur, target, rate, diff, weeks, losing, maintaining } = goalTimeline(answers);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const td = new Date();
  td.setDate(td.getDate() + weeks * 7);
  const dateLabel = `${MONTHS_SHORT[td.getMonth()]} ${td.getDate()}, ${td.getFullYear()}`;

  const X0 = 44, X1 = 272;
  const YHI = 18, YLO = 104, YMID = 62;
  const midX = (X0 + X1) / 2;
  const midWeek = Math.max(1, Math.round(weeks / 2));

  const YSTART = maintaining ? YMID : losing ? YHI : YLO;
  const YEND = maintaining ? YMID : losing ? YLO : YHI;
  const d = YEND - YSTART;

  const greenPath = maintaining
    ? `M${X0} ${YMID} C 110 ${YMID}, 180 ${YMID}, ${X1} ${YMID}`
    : `M${X0} ${YSTART} C 100 ${YSTART + d * 0.25}, 150 ${YEND - d * 0.30}, 200 ${YEND} C 225 ${YEND}, 250 ${YEND}, ${X1} ${YEND}`;

  const greyPath = maintaining
    ? `M${X0} ${YMID} C 110 ${YMID - 8}, 170 ${YMID - 24}, ${X1} ${YMID - 34}`
    : `M${X0} ${YSTART} C 90 ${YSTART + d * 0.20}, 120 ${YSTART + d * 0.50}, 152 ${YSTART + d * 0.55} C 195 ${YSTART + d * 0.62}, 225 ${YSTART + d * 0.30}, ${X1} ${YSTART + d * 0.16}`;

  const goalLabelY = maintaining ? YMID - 9 : losing ? YEND - 9 : YEND + 17;

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]}>
      <Text style={[styles.title, { fontSize: 26 }]}>
        {maintaining ? "You're already there" : `You'll reach ${target} ${unit} by`}
      </Text>
      {!maintaining && <Text style={styles.goalDate}>{dateLabel}</Text>}

      <Text style={[styles.sub, { marginTop: maintaining ? 8 : 10 }]}>
        {maintaining
          ? "Your plan will hold you steady at your current weight."
          : `${diff.toFixed(1)} ${unit} to ${losing ? "lose" : "gain"}, at about ${rate.toFixed(2)} ${unit} a week — roughly ${weeks} ${weeks === 1 ? "week" : "weeks"} of steady logging.`}
      </Text>

      <Animated.View style={{ marginTop: 18, opacity: fade }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 16, paddingTop: 14 }}>
            <Text style={styles.chartAxisTitle}>WEIGHT ({unit.toUpperCase()})</Text>
            <Svg width="100%" height={150} viewBox="0 0 280 150">
              <SvgLine x1={X0} y1={maintaining ? YMID : YEND} x2={X1} y2={maintaining ? YMID : YEND} stroke="#2E2E2E" strokeWidth={1} strokeDasharray="4 4" />

              <SvgText x={38} y={YSTART + 4} fontSize={10} fill={T.sub} fontFamily={FONTS.body} textAnchor="end">{cur}</SvgText>
              {!maintaining && (
                <SvgText x={38} y={YEND + 4} fontSize={10} fill={T.green} fontFamily={FONTS.body} textAnchor="end">{target}</SvgText>
              )}

              <Path d={greyPath} stroke="#4A4A4A" strokeWidth={3} fill="none" strokeLinecap="round" />
              <Path d={greenPath} stroke="#22C55E" strokeWidth={3.5} fill="none" strokeLinecap="round" />

              <SvgText x={X0} y={132} fontSize={10} fill={T.micro} fontFamily={FONTS.body} textAnchor="start">Now</SvgText>
              <SvgText x={midX} y={132} fontSize={10} fill={T.micro} fontFamily={FONTS.body} textAnchor="middle">Week {midWeek}</SvgText>
              <SvgText x={X1} y={132} fontSize={10} fill={T.micro} fontFamily={FONTS.body} textAnchor="end">Week {weeks}</SvgText>

              <SvgText x={X1} y={goalLabelY} fontSize={9.5} fill={T.green} fontFamily={FONTS.body} textAnchor="end">
                {maintaining ? "staying here" : "your goal"}
              </SvgText>
            </Svg>
          </View>
        </TravelBorder>
      </Animated.View>

      <View style={styles.explainCard}>
        <View style={styles.explainRow}>
          <View style={[styles.explainDash, { backgroundColor: T.green }]} />
          <Text style={styles.explainText}>
            <Text style={styles.explainLead}>With MOTION. </Text>
            {maintaining
              ? `You log every day, and your weight holds steady at ${cur} ${unit}.`
              : `You log every day, so your weight moves ${losing ? "down" : "up"} at a steady pace and settles at ${target} ${unit}.`}
          </Text>
        </View>

        <View style={styles.explainDivider} />

        <View style={styles.explainRow}>
          <View style={[styles.explainDash, { backgroundColor: "#4A4A4A" }]} />
          <Text style={[styles.explainText, { color: T.sub }]}>
            <Text style={[styles.explainLead, { color: T.sub }]}>Without tracking. </Text>
            {maintaining
              ? "The usual pattern — without keeping an eye on it, the weight slowly creeps up."
              : `The usual pattern — a strong start, then it stalls, and the weight drifts back toward ${cur} ${unit}.`}
          </Text>
        </View>
      </View>

      <Text style={[styles.sub, { marginTop: 14 }]}>
        This is an estimate from what you've told us. Your plan updates as you log real weigh-ins.
      </Text>

      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 22 }]}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== HEALTH SYNC =====================
   UI + explanation only. The real HealthKit / Health Connect call needs a
   development build — wired at build phase. Stats has its own Connect prompt
   for anyone who skips here. */
function HealthStep({ value, onChange, onNext }: any) {
  const connected = value === "yes";

  /* each row shows what it actually reads. The heart stays RED — health data
     is red across all of iOS, and a green heart beside "Apple Health" fights
     the platform's own convention. */
  const rows: { anim: IconName; t: string; d: string }[] = [
    { anim: "stopwatch", t: "Steps and active minutes", d: "Shown on your Stats tab" },
    { anim: "flameUltimate", t: "Calories burned", d: "Feeds your daily energy balance" },
    { anim: "heartRed", t: "Heart rate", d: "Average resting rate over the week" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.permIcon}><Icon name="heartRed" size={38} mode="loop" /></View>
      <Text style={[styles.title, { fontSize: 26, marginTop: 20 }]}>Connect Apple Health</Text>
      <Text style={styles.sub}>
        MOTION reads your steps, active minutes and calories burned so your daily numbers reflect what you actually did.
      </Text>

      <View style={styles.permCard}>
        {rows.map((r, k) => (
          <View key={k} style={[styles.permRow, k > 0 && styles.permRowBorder]}>
            <View style={styles.permRowIcon}><Icon name={r.anim} size={22} mode="loop" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.permRowTitle}>{r.t}</Text>
              <Text style={styles.permRowSub}>{r.d}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.permNote}>
        MOTION only reads this data. It never writes to Health, and it never shares it with anyone.
      </Text>

      <Pressable
        onPress={() => { onChange("yes"); setTimeout(onNext, 260); }}
        style={[styles.primaryBtn, { marginTop: 24 }, connected && { backgroundColor: T.cardHi }]}
      >
        <Text style={[styles.primaryBtnText, connected && { color: T.green }]}>
          {connected ? "Connected ✓" : "Connect Apple Health"}
        </Text>
      </Pressable>
      <Pressable onPress={() => { onChange("no"); onNext(); }} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={styles.skipText}>Not now — I'll do it later</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== NOTIFICATIONS ===================== */
function NotificationsStep({ value, onChange, onNext }: any) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* the gold bell — it's an alert, not an app control, so it keeps its
          own palette. It sits smaller in its canvas than the line icons,
          hence the larger size. */}
      <View style={styles.permIcon}><Icon name="notification" size={44} mode="loop" /></View>
      <Text style={[styles.title, { fontSize: 26, marginTop: 20 }]}>Don't lose your streak</Text>
      <Text style={styles.sub}>
        A quick nudge before the day ends if you haven't logged. That one reminder is what keeps most people's streaks alive.
      </Text>

      <View style={styles.notifPreview}>
        <View style={styles.notifIcon}><IsoM size={34} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.notifTitle}>MOTION</Text>
          <Text style={styles.notifBody}>You haven't logged anything today — your streak slips if the day ends empty.</Text>
        </View>
      </View>

      <View style={styles.permCard}>
        {[
          { t: "Streak reminders", d: "Only if you haven't logged by evening" },
          { t: "Meal nudges", d: "A gentle prompt around your usual times" },
          { t: "Milestones", d: "When you hit a new tier or reach your goal" },
        ].map((r, k) => (
          <View key={k} style={[styles.permRow, k > 0 && styles.permRowBorder]}>
            <View style={styles.permCheck}><Check size={12} color="#0A0A0A" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.permRowTitle}>{r.t}</Text>
              <Text style={styles.permRowSub}>{r.d}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.permNote}>You can turn any of these off in Profile at any time.</Text>

      <Pressable onPress={() => { onChange("yes"); setTimeout(onNext, 200); }} style={[styles.primaryBtn, { marginTop: 24 }]}>
        <Text style={styles.primaryBtnText}>Turn on reminders</Text>
      </Pressable>
      <Pressable onPress={() => { onChange("no"); onNext(); }} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== ACCOUNT — CREATE OR SIGN IN =====================
   The first REAL backend write in the flow. Everything before this is held in
   memory; this is where the user becomes a row in auth.users.
   The account is created HERE but the profile row is written by finish(),
   after the paywall — so the account and its plan land together.

   ⚠️ IT SIGNS IN TOO, and that's not decoration. Someone who deletes the app
   and reinstalls it can easily miss the "Sign in" link on the welcome screen,
   run the whole flow, and arrive here — where the old version told them
   "there's already an account with that email, try signing in instead" and
   then gave them no way to do it. Naming the fix without providing it is the
   worst version of an error message.

   SIGNING IN DISCARDS THE ANSWERS. See enterExisting() in the parent for why:
   their account's real history has to win over fifteen screens of fresh
   guesses.

   THE RETURN KEYS STAY HERE. Unlike the numeric screens, these are ordinary
   text keyboards where "next" and "go" are exactly what iOS users expect. */
function AccountStep({
  onNext, onAccount, onExisting,
}: {
  onNext: () => void;
  onAccount: (id: string) => void;
  onExisting: () => void;
}) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [agreed, setAgreed] = useState(false);
  const [tips, setTips] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* set when the email is already taken — turns the error into a button
     rather than a dead end */
  const [offerSignIn, setOfferSignIn] = useState(false);

  /* so the keyboard's "next" can jump from email to password */
  const pwRef = useRef<TextInput>(null);

  const creating = mode === "create";
  const ready = email.trim().length > 3 && pw.length >= 6 && (creating ? agreed : true);

  const swapMode = (to: "create" | "signin") => {
    setMode(to);
    setErr(null);
    setOfferSignIn(false);
    /* the EMAIL SURVIVES the swap — they've just typed it, and clearing it
       would be the second annoyance in a row */
  };

  const submit = async () => {
    if (!ready || busy) return;
    Keyboard.dismiss();
    setErr(null);
    setOfferSignIn(false);
    setBusy(true);

    if (creating) {
      const { userId, error } = await signUp(email, pw);

      if (error || !userId) {
        setBusy(false);
        setErr(error || "Couldn't create your account. Try again.");
        /* the exact wording comes from auth.ts's humanize() */
        if (error && error.toLowerCase().includes("already an account")) {
          setOfferSignIn(true);
        }
        return;
      }

      onAccount(userId);
      onNext();
      return;
    }

    /* ---- signing in to something that already exists ---- */
    const { userId, error } = await signIn(email, pw);

    if (error || !userId) {
      setBusy(false);
      setErr(error || "Couldn't sign you in. Try again.");
      return;
    }

    /* straight to the app, answers discarded — see the note above */
    onExisting();
  };

  if (busy) {
    return (
      <View style={[styles.body, { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }]}>
        <IsoMGlow size={104} />
        <Text style={[styles.sub, { marginTop: 0 }]}>
          {creating ? "Creating your account…" : "Signing you in…"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={[styles.title, { fontSize: 26 }]}>
        {creating ? "Save your plan" : "Welcome back"}
      </Text>
      <Text style={styles.sub}>
        {creating
          ? "Create an account so your plan, streak and history follow you to any device."
          : "Sign in and MOTION picks up exactly where you left off — your streak, your history, your plan."}
      </Text>

      {/* SIGNING IN COSTS THEM THE ANSWERS. Said before they commit, not
          after — finding out afterwards would feel like the app threw their
          work away without asking. */}
      {!creating && (
        <View style={styles.noticeRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.noticeText}>
            Your existing plan will be used, not the answers you just gave. Nothing on your account
            changes.
          </Text>
        </View>
      )}

      <View style={{ marginTop: 22, gap: 10 }}>
        {/* Apple and Google need native SDKs and a development build — neither
            runs in Expo Go, so they're wired alongside that */}
        <Pressable
          onPress={() => setErr("Apple sign-in isn't wired yet — use your email for now.")}
          style={[styles.authBtn, { backgroundColor: "#FFFFFF" }]}
        >
          <Icon name="appleDark" size={20} mode="loop" />
          <Text style={[styles.authText, { color: "#0A0A0A" }]}>Continue with Apple</Text>
        </Pressable>

        <Pressable
          onPress={() => setErr("Google sign-in isn't wired yet — use your email for now.")}
          style={[styles.authBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
        >
          <Icon name="google" size={19} mode="loop" />
          <Text style={[styles.authText, { color: T.text }]}>Continue with Google</Text>
        </Pressable>
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>

      <View style={styles.emailBox}>
        <Icon name="email" size={18} mode="loop" />
        <TextInput
          value={email}
          onChangeText={(t) => { setEmail(t); setErr(null); setOfferSignIn(false); }}
          placeholder="name@email.com"
          placeholderTextColor={T.micro}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
          /* the keyboard's return key moves to the password rather than
             closing — one less tap in a two-field form */
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
        />
      </View>

      <View style={[styles.emailBox, { marginTop: 10 }]}>
        <Icon name="password" size={18} mode="loop" />
        <TextInput
          ref={pwRef}
          value={pw}
          onChangeText={(t) => { setPw(t); setErr(null); setOfferSignIn(false); }}
          placeholder={creating ? "Create a password" : "Your password"}
          placeholderTextColor={T.micro}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
          /* and from the password, return submits — but only when everything
             is filled in, including the terms box */
          returnKeyType="go"
          onSubmitEditing={() => { if (ready) submit(); else Keyboard.dismiss(); }}
        />
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10}>
          {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
        </Pressable>
      </View>

      {creating && pw.length > 0 && pw.length < 6 && (
        <Text style={styles.pwHint}>At least 6 characters.</Text>
      )}

      {err ? (
        <View style={styles.errRow}>
          <AlertTriangle size={14} color={T.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errText}>{err}</Text>

            {/* THE FIX, NOT JUST THE DIAGNOSIS. The email is already typed, so
                this is one tap from being signed in. */}
            {offerSignIn && (
              <Pressable onPress={() => swapMode("signin")} style={styles.errAction}>
                <Text style={styles.errActionText}>Sign in to that account instead</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {creating && (
        <View style={{ marginTop: 20, gap: 12 }}>
          <Pressable onPress={() => setAgreed(!agreed)} style={styles.agreeRow}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>{agreed && <Check size={13} color="#0A0A0A" />}</View>
            <Text style={styles.agreeText}>
              I agree to MOTION's <Text style={{ color: T.green }}>Terms</Text> and <Text style={{ color: T.green }}>Privacy Policy</Text>
            </Text>
          </Pressable>

          <Pressable onPress={() => setTips(!tips)} style={styles.agreeRow}>
            <View style={[styles.checkbox, tips && styles.checkboxOn]}>{tips && <Check size={13} color="#0A0A0A" />}</View>
            <Text style={styles.agreeText}>Send me occasional tips and updates</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={submit} style={[styles.primaryBtn, { marginTop: 24 }, !ready && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ready && styles.btnTextDisabled]}>
          {creating ? "Create account" : "Sign in"}
        </Text>
      </Pressable>

      {creating && !agreed && <Text style={styles.agreeHint}>Tick the terms box to continue.</Text>}

      {/* the way between the two modes, always available */}
      <Pressable
        onPress={() => swapMode(creating ? "signin" : "create")}
        style={{ alignItems: "center", marginTop: 18 }}
        hitSlop={8}
      >
        <Text style={styles.signInText}>
          {creating ? (
            <>Already have an account? <Text style={{ color: T.green }}>Sign in</Text></>
          ) : (
            <>Need a new account? <Text style={{ color: T.green }}>Create one</Text></>
          )}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== YOUR PLAN ===================== */
function PlanStep({ answers, onNext }: any) {
  const plan = buildPlan(answers);
  const unit = answers.body?.wUnit || "kg";
  const target = answers.desired?.val;

  let coaching = "";
  if (answers.goal === "lose") {
    coaching = `This sits about ${plan.tdee - plan.calories} calories under what your body burns in a day — enough to lose steadily without leaving you hungry.`;
  } else if (answers.goal === "gain") {
    coaching = `This sits about ${plan.calories - plan.tdee} calories above what your body burns in a day — enough to build without piling on fat.`;
  } else {
    coaching = "This matches what your body burns in a day, so your weight holds steady while you build the logging habit.";
  }

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]}>
      <Text style={[styles.title, { fontSize: 27 }]}>Your daily plan{"\n"}is ready</Text>
      <Text style={styles.sub}>Motion built this from everything you told us. You can change it anytime in Profile.</Text>

      <View style={{ marginTop: 24 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 20 }}>
            <Text style={styles.micro}>DAILY CALORIES</Text>
            <View style={styles.planCalRow}>
              <Text style={styles.planCal}>{plan.calories.toLocaleString()}</Text>
              <Text style={styles.planCalUnit}>cal a day</Text>
            </View>
            <View style={styles.macroTiles}>
              {[["Protein", plan.protein, T.green], ["Carbs", plan.carbs, T.carbs], ["Fat", plan.fat, T.fat]].map(([label, v, col]: any, k) => (
                <View key={k} style={styles.macroTile}>
                  <Text style={[styles.macroTileNum, { color: col }]}>{v}g</Text>
                  <Text style={styles.macroTileLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </TravelBorder>
      </View>

      <View style={styles.coachCard}>
        <Sparkles size={14} color={T.green} />
        <Text style={styles.coachText}>{coaching}</Text>
      </View>

      {plan.hitFloor && (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.warnText}>
            We've held your target at a safe minimum. Going lower isn't healthy — a gentler pace will get you there just as well.
          </Text>
        </View>
      )}

      {target ? (
        <Text style={[styles.sub, { marginTop: 16 }]}>
          Stick to this and you're on track for {target} {unit}. Log a real weigh-in whenever you like and Motion recalculates.
        </Text>
      ) : null}

      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 26 }]}>
        <Text style={styles.primaryBtnText}>Let's go</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== SHARED STEPS ===================== */
function ChoiceIcon({ c }: { c: Choice }) {
  if (!c.icon) return null;
  return (
    <View style={styles.choiceIcon}>
      <Icon name={c.icon} size={23} mode="loop" />
    </View>
  );
}

function SingleStep({ step, value, onPick }: any) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}
      <View style={{ marginTop: 24, gap: 10 }}>
        {step.choices.map((c: Choice) => {
          const on = value === c.key;
          return (
            <Pressable key={c.key} onPress={() => onPick(c.key)} style={[styles.choice, on && styles.choiceOn]}>
              <ChoiceIcon c={c} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceLabel, on && { color: T.green }]}>{c.label}</Text>
                {c.sub ? <Text style={styles.choiceSub}>{c.sub}</Text> : null}
              </View>
              {on && <Check size={18} color={T.green} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function BuildingStep({ step }: any) {
  return (
    <View style={[styles.body, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
      <IsoMGlow size={104} />
      <Text style={[styles.title, { textAlign: "center", marginTop: 24, fontSize: 22 }]}>{step.title}</Text>
      <Text style={[styles.sub, { textAlign: "center", marginTop: 8 }]}>{step.sub}</Text>
    </View>
  );
}

/* ===================== WHERE DID YOU HEAR ABOUT US =====================
   LAST IN THE FLOW, and skippable. It does nothing for the user — it's
   attribution, so Dion can see which channel actually converts once he's
   paying for ads. After the paywall means it can't cost a signup. */
function HeardStep({ onPick, onSkip }: { onPick: (k: string) => void; onSkip: () => void }) {
  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]}>
      <Text style={[styles.title, { fontSize: 26 }]}>One last thing</Text>
      <Text style={styles.sub}>Where did you hear about MOTION? It helps us know where to find people like you.</Text>

      <View style={{ marginTop: 24, gap: 10 }}>
        {HEARD_CHOICES.map((c) => (
          <Pressable key={c.key} onPress={() => onPick(c.key)} style={styles.choice}>
            <ChoiceIcon c={c} />
            <Text style={[styles.choiceLabel, { flex: 1 }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={onSkip} style={{ alignItems: "center", marginTop: 20 }}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== TRIAL PAYWALL =====================
   NO CARD FORM — on iOS, subscriptions must go through Apple's IAP sheet, so
   "Start free trial" hands off to StoreKit and Apple charges the card already
   on the user's Apple ID. `onStartTrial` becomes the StoreKit call. */
const PLANS = [
  { key: "monthly", name: "Pro · Monthly", price: "$9.99", per: "/mo", note: "3 days free, then $9.99/mo" },
  { key: "yearly", name: "Pro · Yearly", price: "$99.99", per: "/yr", note: "3 days free, then $99.99/yr", tag: "Popular" },
  { key: "lifetime", name: "Pro · Lifetime", price: "$499.99", per: "once", note: "Pay once — yours for life", tag: "Best value" },
];

function TrialPaywall({ onStartTrial, onSkip }: { onStartTrial: () => void; onSkip: () => void }) {
  const [plan, setPlan] = useState("yearly");
  const chosen = PLANS.find((p) => p.key === plan) || PLANS[1];

  const feats: { anim: IconName; label: string }[] = [
    { anim: "camera", label: "Unlimited photo logging" },
    { anim: "mic", label: "Motion Voice AI — describe meals, no typing" },
    { anim: "barcode", label: "Barcode scanner for exact facts" },
    { anim: "watchHealth", label: "Apple Watch & Health sync" },
    { anim: "trophy", label: "Leaderboard & streak badges" },
    { anim: "support", label: "Priority support, 24/7" },
  ];

  const timeline: { anim?: IconName; lucide?: any; day: string; text: string }[] = [
    { lucide: Sparkles, day: "Today", text: "Full access unlocked — every Pro feature." },
    { anim: "notification", day: "Day 3", text: "We'll remind you your trial ends tomorrow." },
    { anim: "creditCard", day: "Day 4", text: `${chosen.price} begins — unless you cancel.` },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <IsoMGlow size={78} />
      </View>
      <Text style={[styles.title, { fontSize: 26 }]}>Unlock everything</Text>
      <Text style={[styles.sub, { marginTop: 8 }]}>Try MOTION Pro free for 3 days.</Text>

      <View style={{ marginTop: 20 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 18, gap: 14 }}>
            {feats.map((f, k) => (
              <View key={k} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Icon name={f.anim} size={21} mode="loop" />
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </TravelBorder>
      </View>

      <Text style={[styles.micro, { marginTop: 24, marginBottom: 10 }]}>CHOOSE YOUR PLAN</Text>

      <View style={{ gap: 9 }}>
        {PLANS.map((p) => {
          const on = p.key === plan;
          return (
            <Pressable key={p.key} onPress={() => setPlan(p.key)} style={[styles.planRow, on && styles.planRowOn]}>
              <View style={styles.planCrown}>
                <Crown size={17} color="#0A0A0A" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {p.tag && (
                    <View style={styles.planTag}>
                      <Text style={styles.planTagText}>{p.tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planNote}>{p.note}</Text>
              </View>
              <Text style={styles.planPrice}>
                {p.price} <Text style={styles.planPer}>{p.per}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.planFine}>
        All plans unlock the same Pro — cancel monthly or yearly anytime; lifetime is a one-time payment.
      </Text>

      <Text style={[styles.micro, { marginTop: 22, marginBottom: 10 }]}>HOW YOUR FREE TRIAL WORKS</Text>

      <View style={styles.trialCard}>
        {timeline.map((r, k) => (
          <View key={k} style={[styles.trialRow, k > 0 && styles.trialRowBorder]}>
            <View style={styles.trialIcon}>
              {r.anim
                ? <Icon name={r.anim} size={r.anim === "notification" ? 28 : 21} mode="loop" />
                : <r.lucide size={17} color={T.green} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trialDay}>{r.day}</Text>
              <Text style={styles.trialText}>{r.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.trialFootText}>
        3 days free, then <Text style={{ color: T.green }}>{chosen.price} US{chosen.per}</Text> · cancel anytime
      </Text>

      <Pressable onPress={onStartTrial} style={[styles.primaryBtn, { marginTop: 14 }]}>
        <Text style={styles.primaryBtnText}>Start 3-day free trial</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={styles.skipText}>Continue with the free version</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: T.green, borderRadius: 99 },

  body: { padding: 24, paddingTop: 16 },
  title: { fontSize: 24, color: T.text, fontFamily: FONTS.heading, lineHeight: 32 },
  sub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body, marginTop: 8, lineHeight: 20 },
  micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body },

  stepHero: { alignItems: "center", marginBottom: 16 },

  welcomeTop: { paddingTop: 60, paddingHorizontal: 20, alignItems: "flex-end" },
  langChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  langText: { fontSize: 12, color: T.sub, fontFamily: FONTS.bodyMed },
  welcomeBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  welcomeTitle: { fontSize: 32, color: T.text, fontFamily: FONTS.heading, textAlign: "center", lineHeight: 38 },
  welcomeSub: { fontSize: 14.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginTop: 14, lineHeight: 21 },
  welcomeFooter: { padding: 24, paddingBottom: 44 },
  signInText: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 28 },
  langCard: { width: "100%", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 22, padding: 20 },
  langCardTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading, marginBottom: 14 },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4 },
  langRowOn: { backgroundColor: T.greenBg },
  langRowText: { fontSize: 14.5, color: T.text, fontFamily: FONTS.body },

  /* sex tiles — side by side, because two options in a column looks like the
     start of a longer list */
  sexTile: {
    flex: 1, alignItems: "center", gap: 8,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, paddingVertical: 18,
  },
  sexLabel: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },

  /* a field's label and its unit toggle on one line — the two-question
     screens have no room for a full-width toggle under each heading */
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26 },

  permIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center", marginTop: 8 },
  permCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, marginTop: 22, overflow: "hidden" },
  permRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
  permRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  permRowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
  permCheck: { width: 22, height: 22, borderRadius: 7, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  permRowTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
  permRowSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  permNote: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, marginTop: 14, lineHeight: 17 },

  notifPreview: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 14, marginTop: 22 },
  notifIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  notifTitle: { fontSize: 12, color: T.text, fontFamily: FONTS.heading },
  notifBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 17 },

  authBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 15 },
  authText: { fontSize: 14.5, fontFamily: FONTS.headingMed },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: T.border },
  orText: { fontSize: 12, color: T.micro, fontFamily: FONTS.body },
  emailBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginTop: 22 },
  emailInput: { flex: 1, color: T.text, fontFamily: FONTS.body, fontSize: 14.5, padding: 0 },
  pwHint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 6, marginLeft: 2 },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  agreeText: { flex: 1, fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18 },
  agreeHint: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 12 },

  errRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14, backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12 },
  errText: { fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },
  errAction: { marginTop: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  errActionText: { fontSize: 12.5, color: T.green, fontFamily: FONTS.headingMed },

  /* the "your answers won't be used" heads-up on the sign-in side */
  noticeRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16,
    backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)", borderRadius: 12, padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: "#FBBF24", fontFamily: FONTS.body, lineHeight: 17.5 },

  explainCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 16, marginTop: 16 },
  explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  explainDash: { width: 20, height: 4, borderRadius: 2, marginTop: 6 },
  explainText: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: FONTS.body, lineHeight: 18.5 },
  explainLead: { fontFamily: FONTS.heading, color: T.green },
  explainDivider: { height: 1, backgroundColor: T.border, marginVertical: 13 },
  chartAxisTitle: { fontSize: 9, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, marginBottom: 2 },

  planCalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  planCal: { fontSize: 46, color: T.text, fontFamily: FONTS.heading },
  planCalUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
  macroTiles: { flexDirection: "row", gap: 8, marginTop: 18 },
  macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  macroTileNum: { fontSize: 17, fontFamily: FONTS.heading },
  macroTileLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3, textTransform: "uppercase" },
  coachCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 14, padding: 14, marginTop: 14 },
  coachText: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: FONTS.body, lineHeight: 18 },

  /* GREEN, not grey — it's an instruction, and grey fine print is exactly
     what people skip past before deciding the wheel is broken */
  scrollHint: { fontSize: 11.5, color: T.green, fontFamily: FONTS.bodyMed, marginTop: 4 },
  wheelWrap: { marginTop: 8, alignItems: "center", justifyContent: "center", position: "relative" },
  /* the band sits over the CENTRE row — its offset has to match WHEEL_PAD, or
     the highlight and the selected value drift apart */
  wheelBand: { position: "absolute", top: ITEM_H * WHEEL_PAD, left: 0, right: 0, height: ITEM_H, borderRadius: 12, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, zIndex: 0 },
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  wheelCell: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelItem: { fontSize: 16.5, color: T.micro, fontFamily: FONTS.body },
  wheelItemOn: { color: T.text, fontFamily: FONTS.heading, fontSize: 18 },

  unitToggle: { flexDirection: "row", gap: 6, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 4, marginTop: 26, alignSelf: "flex-start" },
  unitPill: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 9 },
  unitPillSmall: { paddingHorizontal: 13, paddingVertical: 6 },
  unitPillOn: { backgroundColor: T.green },
  unitPillText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  unitPillTextOn: { color: "#0A0A0A" },

  entryRow: { flexDirection: "row", alignItems: "baseline", marginTop: 30 },
  entryRowTight: { flexDirection: "row", alignItems: "baseline", marginTop: 14 },
  bigInput: { fontSize: 54, color: T.text, fontFamily: FONTS.heading, minWidth: 130, padding: 0, borderBottomWidth: 2, borderBottomColor: T.greenBorder, textAlign: "center" },
  /* smaller than bigInput — two of these share a screen, and 54pt twice
     pushes the button below the fold */
  midInput: { fontSize: 40, color: T.text, fontFamily: FONTS.heading, minWidth: 110, padding: 0, borderBottomWidth: 2, borderBottomColor: T.greenBorder, textAlign: "center" },
  entryUnit: { fontSize: 18, color: T.sub, fontFamily: FONTS.body, marginLeft: 10 },

  warnRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14, backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", borderRadius: 12, padding: 12 },
  noteRowOk: { backgroundColor: T.greenBg, borderColor: T.greenBorder },
  warnText: { flex: 1, fontSize: 12.5, color: "#FBBF24", fontFamily: FONTS.body, lineHeight: 18 },
  currentChip: { alignSelf: "flex-start", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, marginTop: 22 },
  currentChipText: { fontSize: 12, color: T.sub, fontFamily: FONTS.bodyMed },
  btnDisabled: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
  btnTextDisabled: { color: T.micro },

  goalDate: { fontSize: 34, color: T.green, fontFamily: FONTS.heading, marginTop: 6 },

  choice: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16 },
  choiceOn: { borderColor: T.green, backgroundColor: T.greenBg },
  choiceIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  choiceLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
  choiceSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: T.green, borderColor: T.green },

  primaryBtn: { backgroundColor: T.green, borderRadius: 14, padding: 16, alignItems: "center" },
  primaryBtnText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 15 },
  skipText: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

  featureRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  featureIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 13.5, color: T.text, fontFamily: FONTS.body },

  planRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 15, paddingVertical: 13, paddingHorizontal: 14,
  },
  planRowOn: { borderColor: T.green, backgroundColor: T.greenBg },
  planCrown: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.gold, alignItems: "center", justifyContent: "center" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  planName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
  planTag: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  planTagText: { fontSize: 9, color: T.green, fontFamily: FONTS.headingMed },
  planNote: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  planPrice: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
  planPer: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },
  planFine: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 10, lineHeight: 15 },

  trialCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden" },
  trialRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
  trialRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  trialIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
  trialDay: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
  trialText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 2, lineHeight: 17 },
  trialFootText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginTop: 16 },
});