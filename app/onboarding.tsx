// app/onboarding.tsx
import { useRouter } from "expo-router";
import { AlertTriangle, Check, ChevronLeft, Crown, Eye, EyeOff, Sparkles } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path, Line as SvgLine, Text as SvgText } from "react-native-svg";
import AppleFruit from "../components/AppleFruit";
import BroccoliIcon from "../components/BroccoliIcon";
import CutleryIcon from "../components/CutleryIcon";
import EggIcon from "../components/EggIcon";
import Icon, { IconName } from "../components/Icon";
import IsoM, { IsoMGlow } from "../components/IsoM";
import SheenIcon from "../components/SheenIcon";
import SteakIcon from "../components/SteakIcon";
import TravelBorder from "../components/TravelBorder";
import { useApp } from "../constants/AppState";
import { signUp } from "../constants/auth";
import { DARK, FONTS } from "../constants/theme";

const T = DARK;

/* A choice's icon can come from three places, because no single source covers
   everything the app needs:
     icon        — one of our Lottie animations
     lucide      — a Lucide icon, wrapped in SheenIcon so it still has life
     lucideColor — a colour for that Lucide icon
     custom      — a component of its own, for real artwork. The diet rows all
                   use this: food reads far better as food than as a tinted
                   line drawing. */
type Choice = {
  key: string;
  label: string;
  sub?: string;
  icon?: IconName;
  lucide?: any;
  lucideColor?: string;
  custom?: any;
};

type Step =
  | { kind: "welcome"; id: string }
  | { kind: "single"; id: string; title: string; sub?: string; choices: Choice[] }
  | { kind: "multi"; id: string; title: string; sub?: string; choices: Choice[] }
  | { kind: "wheel"; id: string; title: string; sub?: string }
  | { kind: "height"; id: string; title: string; sub?: string }
  | { kind: "weight"; id: string; title: string; sub?: string }
  | { kind: "desired"; id: string; title: string; sub?: string }
  | { kind: "goaldate"; id: string }
  | { kind: "graph"; id: string }
  | { kind: "histogram"; id: string }
  | { kind: "personalize"; id: string }
  | { kind: "health"; id: string }
  | { kind: "notifications"; id: string }
  | { kind: "referral"; id: string }
  | { kind: "building"; id: string; title: string; sub?: string }
  | { kind: "plan"; id: string }
  | { kind: "signin"; id: string }
  | { kind: "message"; id: string; title: string; sub?: string; cta: string }
  | { kind: "paywall"; id: string };

const STEPS: Step[] = [
  { kind: "welcome", id: "welcome" },

  { kind: "single", id: "sex", title: "What's your sex?", sub: "This helps us calculate your daily energy needs accurately.", choices: [
    { key: "male", label: "Male", icon: "male" },
    { key: "female", label: "Female", icon: "female" },
  ]},

  { kind: "single", id: "workouts", title: "How many workouts do you do per week?", sub: "This will be used to calibrate your custom plan.", choices: [
    { key: "0-2", label: "0 – 2", sub: "Workouts now and then", icon: "dumbbell" },
    { key: "3-5", label: "3 – 5", sub: "A few workouts per week", icon: "dumbbell" },
    { key: "6+", label: "6 +", sub: "Dedicated athlete", icon: "dumbbell" },
  ]},

  { kind: "wheel", id: "birthday", title: "When were you born?", sub: "This helps us calculate your daily energy needs accurately." },

  /* the brand logos keep their OWN colours — a green Google or Instagram is
     wrong, and for Google it breaches their guidelines */
  { kind: "single", id: "heard", title: "Where did you hear about us?", choices: [
    { key: "tv", label: "TV", icon: "tv" },
    { key: "youtube", label: "YouTube", icon: "youtube" },
    { key: "google", label: "Google", icon: "google" },
    { key: "facebook", label: "Facebook", icon: "facebook" },
    { key: "x", label: "X", icon: "xTwitter" },
    { key: "tiktok", label: "TikTok", icon: "tiktok" },
    { key: "instagram", label: "Instagram", icon: "instagram" },
    { key: "appstore", label: "App Store", icon: "appStore" },
    { key: "friends", label: "Friends / Family", icon: "friendsFamily" },
    { key: "other", label: "Other", icon: "otherDots" },
  ]},

  { kind: "single", id: "tried", title: "Have you tried other calorie apps?", choices: [
    { key: "no", label: "No", sub: "This is my first one", icon: "no" },
    { key: "yes", label: "Yes", sub: "I've used one before", icon: "yes" },
  ]},

  { kind: "height", id: "height", title: "How tall are you?", sub: "We use this to work out your daily energy needs." },
  { kind: "weight", id: "weight", title: "What's your weight?", sub: "Be honest — this shapes your whole plan. You can update it anytime." },

  { kind: "single", id: "goal", title: "What's your goal?", sub: "We'll shape your whole plan around this — you can change it anytime.", choices: [
    { key: "lose", label: "Lose weight", icon: "goalChartDown" },
    { key: "maintain", label: "Maintain", icon: "goalFlat" },
    { key: "gain", label: "Gain weight", icon: "goalChartUp" },
  ]},

  { kind: "single", id: "activity", title: "How active are you?", sub: "Outside of workouts, day to day.", choices: [
    { key: "low", label: "Little to no exercise" },
    { key: "light", label: "Light — 1–3 days/week" },
    { key: "mod", label: "Moderate — 3–5 days/week" },
    { key: "high", label: "Very active — 6–7 days/week" },
  ]},

  { kind: "single", id: "pace", title: "How fast do you want to go?", sub: "You can change this anytime.", choices: [
    { key: "slow", label: "Steady", sub: "Slow & sustainable · 0.25 kg a week" },
    { key: "mod", label: "Balanced", sub: "Our recommendation · 0.5 kg a week" },
    { key: "fast", label: "Aggressive", sub: "Faster results · 0.75 kg a week" },
  ]},

  { kind: "single", id: "trainer", title: "Do you work with a personal trainer or dietitian?", sub: "We'll keep your plan in step with their advice.", choices: [
    { key: "no", label: "No", sub: "Just me", icon: "no" },
    { key: "yes", label: "Yes", sub: "I work with someone", icon: "yes" },
  ]},

  { kind: "desired", id: "desired", title: "What's your desired weight?", sub: "Pick a target that feels realistic — you can change it later." },
  { kind: "goaldate", id: "goaldate" },
  { kind: "graph", id: "graph" },
  { kind: "histogram", id: "histogram" },

  /* NO ICONS HERE, deliberately. "Unhealthy eating habits" and "lack of
     support" are things people find hard to admit — a cheerful animated icon
     beside them would read as the app being breezy about it. */
  { kind: "multi", id: "stopping", title: "What's stopping you from reaching your goal?", sub: "Pick all that apply — we'll build around them.", choices: [
    { key: "consistency", label: "Staying consistent", sub: "Starting is easy, keeping it up isn't" },
    { key: "habits", label: "Unhealthy eating habits", sub: "Snacking, late meals, portion creep" },
    { key: "support", label: "Lack of support", sub: "Nobody keeping you accountable" },
    { key: "busy", label: "A busy schedule", sub: "No time to weigh and log everything" },
    { key: "inspiration", label: "Not knowing what to eat", sub: "Same meals on repeat" },
  ]},

  /* every option carries real artwork. Broccoli for vegetarian rather than a
     second carrot — vegan already has one, and two carrots in one list is a
     coin-flip for the user rather than a choice. */
  { kind: "single", id: "diet", title: "Do you follow a specific diet?", choices: [
    { key: "none", label: "No specific diet", custom: CutleryIcon },
    { key: "balanced", label: "Balanced", icon: "dietSalad" },
    { key: "wholefood", label: "Wholefood", custom: AppleFruit },
    { key: "lowcarb", label: "Low carb", custom: SteakIcon },
    { key: "keto", label: "Keto", custom: EggIcon },
    { key: "vegetarian", label: "Vegetarian", custom: BroccoliIcon },
    { key: "vegan", label: "Vegan", icon: "dietVegan" },
    { key: "pescatarian", label: "Pescatarian", icon: "dietFish" },
  ]},

  { kind: "multi", id: "accomplish", title: "What would you like to accomplish?", sub: "Pick all that apply.", choices: [
    { key: "healthier", label: "Eat healthier", icon: "heart" },
    { key: "energy", label: "Boost my energy", icon: "strongArm" },
    { key: "body", label: "Feel better about my body", icon: "accomplishSmile" },
    { key: "consistent", label: "Stay consistent", icon: "accomplishCalendar" },
  ]},

  { kind: "health", id: "health" },

  { kind: "single", id: "burned", title: "Add burned calories back to your day?", sub: "When you train, MOTION can top up your target by what you burned.", choices: [
    { key: "yes", label: "Yes, add them back", sub: "Train hard, eat a little more that day", icon: "yes" },
    { key: "no", label: "No, keep it fixed", sub: "Same target every day — simpler to follow", icon: "no" },
  ]},

  { kind: "notifications", id: "notifications" },
  { kind: "referral", id: "referral" },
  { kind: "personalize", id: "personalize" },
  { kind: "building", id: "building", title: "Building your plan", sub: "Motion is crunching your numbers…" },
  { kind: "plan", id: "plan" },
  { kind: "signin", id: "signin" },
  { kind: "paywall", id: "paywall" },
];

const LANGUAGES = [
  "English", "Español", "Français", "Deutsch", "Italiano", "Português",
  "Nederlands", "Polski", "Türkçe", "Русский", "العربية", "हिन्दी",
  "中文", "日本語", "한국어",
];

const PACE_RATE: Record<string, number> = { slow: 0.25, mod: 0.5, fast: 0.75 };

/* ===================== THE PLAN CALCULATION =====================
   The NUMBER comes from a formula (Mifflin-St Jeor + activity factor),
   not from the AI — same inputs always give the same target, and it's
   clinically grounded. Motion supplies the coaching around it. */
function buildPlan(a: Record<string, any>) {
  const wUnit = a.weight?.unit || "kg";
  const wRaw = parseFloat(a.weight?.val) || 75;
  const kg = wUnit === "kg" ? wRaw : wRaw / 2.20462;

  let cm = 175;
  if (a.height?.unit === "cm") {
    cm = parseFloat(a.height.cm) || 175;
  } else if (a.height) {
    const ft = parseFloat(a.height.ft) || 5;
    const inch = parseFloat(a.height.inch) || 0;
    cm = (ft * 12 + inch) * 2.54;
  }

  let age = 28;
  if (a.birthday) {
    const now = new Date();
    age = now.getFullYear() - a.birthday.y;
    const had = now.getMonth() > a.birthday.m || (now.getMonth() === a.birthday.m && now.getDate() >= a.birthday.d);
    if (!had) age -= 1;
  }

  const bmr = a.sex === "female"
    ? 10 * kg + 6.25 * cm - 5 * age - 161
    : 10 * kg + 6.25 * cm - 5 * age + 5;

  const base: Record<string, number> = { low: 1.2, light: 1.375, mod: 1.55, high: 1.725 };
  const bump: Record<string, number> = { "0-2": 0, "3-5": 0.05, "6+": 0.1 };
  const mult = (base[a.activity] || 1.375) + (bump[a.workouts] || 0);
  const tdee = bmr * mult;

  const rate = PACE_RATE[a.pace] || 0.5;
  const dailyShift = (rate * 7700) / 7;
  let target = tdee;
  if (a.goal === "lose") target = tdee - dailyShift;
  if (a.goal === "gain") target = tdee + dailyShift;

  const floor = a.sex === "female" ? 1200 : 1500;
  target = Math.max(floor, target);
  const hitFloor = target === floor && a.goal === "lose";

  const calories = Math.round(target / 10) * 10;
  const protein = Math.round(kg * 1.8);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  // cm is returned so finish() can store it — Profile's Goal screen needs
  // height to recompute BMR later without guessing
  return { calories, protein, carbs, fat, tdee: Math.round(tdee), hitFloor, kg, cm: Math.round(cm) };
}

function goalTimeline(a: Record<string, any>) {
  const unit = a.weight?.unit || "kg";
  const cur = parseFloat(a.weight?.val) || 0;
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

  /* set by SignInStep once the account exists. finish() needs it to write the
     profile row — no account, nowhere to attach the plan. */
  const [userId, setUserId] = useState<string | null>(null);

  const step = STEPS[i];
  const total = STEPS.length;

  const goNext = () => {
    if (i < total - 1) { setDir(1); setI(i + 1); }
    else finish(false);
  };
  const goBack = () => { if (i > 0) { setDir(-1); setI(i - 1); } };

  const finish = (pro: boolean) => {
    // hand the generated plan to the rest of the app before we leave onboarding
    const p = buildPlan(answers);
    const tl = goalTimeline(answers);
    const b = answers.birthday || { d: 12, m: 2, y: 2001 };

    savePlan(
      {
        calories: p.calories,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        tdee: p.tdee,
        addBurned: answers.burned === "yes",
      },
      {
        name: "Dion",
        /* SEX and HEIGHT are stored because Profile → Goal recomputes BMR from
           the body when you change your goal. Without them it would have to
           guess, and the female constant differs by 166 calories. */
        sex: (answers.sex || "male") as "male" | "female",
        heightCm: p.cm,
        heightUnit: (answers.height?.unit === "cm" ? "cm" : "ft") as "cm" | "ft",
        dobDay: b.d,
        dobMonth: b.m,
        dobYear: b.y,
        goal: (answers.goal || "lose") as "lose" | "maintain" | "gain",
        weightUnit: (tl.unit || "kg") as "kg" | "lbs",
        startWeight: tl.cur,
        targetWeight: tl.target,
        paceRate: PACE_RATE[answers.pace] || 0.5,
        goalWeeks: tl.weeks,
        /* the answers that don't feed the formula but do belong on the record:
           diet shapes food suggestions, and heardFrom is the attribution that
           tells us which ad channel actually converts */
        diet: answers.diet,
        activity: answers.activity,
        workouts: answers.workouts,
        heardFrom: answers.heard,
        isPro: pro,
      } as any,
      /* THE ID MATTERS HERE. SignInStep created the account moments ago and
         AppState's auth listener may not have caught up yet — passing it
         explicitly means the profile write can't miss. */
      userId || undefined
    );
    setIsPro(pro);
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
        {step.kind === "single" && <SingleStep step={step} value={answers[step.id]} onPick={(k: string) => { set(step.id, k); setTimeout(goNext, 180); }} />}
        {step.kind === "multi" && <MultiStep step={step} value={answers[step.id] || []} onChange={(v: string[]) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "wheel" && <BirthdayStep step={step} value={answers[step.id]} onChange={(v: any) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "height" && <HeightStep step={step} value={answers[step.id]} onChange={(v: any) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "weight" && <WeightStep step={step} value={answers[step.id]} onChange={(v: any) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "desired" && <DesiredStep step={step} value={answers[step.id]} current={answers.weight} goal={answers.goal} onChange={(v: any) => set(step.id, v)} onNext={goNext} />}
        {step.kind === "goaldate" && <GoalDateStep answers={answers} onNext={goNext} />}
        {step.kind === "graph" && <GraphStep answers={answers} onNext={goNext} />}
        {step.kind === "histogram" && <HistogramStep onNext={goNext} />}
        {step.kind === "health" && <HealthStep value={answers.health} onChange={(v: any) => set("health", v)} onNext={goNext} />}
        {step.kind === "notifications" && <NotificationsStep value={answers.notifications} onChange={(v: any) => set("notifications", v)} onNext={goNext} />}
        {step.kind === "referral" && <ReferralStep value={answers.referral} onChange={(v: any) => set("referral", v)} onNext={goNext} />}
        {step.kind === "personalize" && <PersonalizeStep answers={answers} onNext={goNext} />}
        {step.kind === "plan" && <PlanStep answers={answers} onNext={goNext} />}
        {step.kind === "signin" && <SignInStep onNext={goNext} onAccount={setUserId} />}
        {step.kind === "message" && <MessageStep step={step} onNext={goNext} />}
        {step.kind === "building" && <BuildingStep step={step} />}
        {step.kind === "paywall" && <TrialPaywall onStartTrial={() => finish(true)} onSkip={() => finish(false)} />}
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

        {/* returning users cross straight to sign-in — nobody with an account
            should have to answer thirty questions to get back in */}
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

/* ===================== HEALTH SYNC =====================
   UI + explanation only. The real HealthKit / Health Connect call needs a
   development build (it does NOT work in Expo Go) — wire at backend phase. */
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

/* ===================== REFERRAL ===================== */
function ReferralStep({ value, onChange, onNext }: any) {
  const code = value || "";
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { fontSize: 26 }]}>Got a referral code?</Text>
      <Text style={styles.sub}>Enter it here if someone shared one with you. If not, skip straight past.</Text>

      <TextInput
        value={code}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        placeholder="MOTION25"
        placeholderTextColor={T.micro}
        autoCapitalize="characters"
        style={styles.codeInput}
        maxLength={12}
      />

      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 26 }]}>
        <Text style={styles.primaryBtnText}>{code.length > 0 ? "Apply code" : "Continue"}</Text>
      </Pressable>
      <Pressable onPress={onNext} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={styles.skipText}>Skip — I don't have one</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== CREATE ACCOUNT =====================
   The first REAL backend write in the flow. Everything before this is held in
   memory; this is where the user becomes a row in auth.users.
   The account is created HERE but the profile row is written by finish(),
   after the paywall decision — so the account and its plan land together and
   there's never an account with no plan attached. */
function SignInStep({ onNext, onAccount }: { onNext: () => void; onAccount: (id: string) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [tips, setTips] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = agreed && email.trim().length > 3 && pw.length >= 6;

  const create = async () => {
    if (!ready || busy) return;
    setErr(null);
    setBusy(true);

    const { userId, error } = await signUp(email, pw);

    if (error || !userId) {
      /* stay on the screen with the reason — bouncing away loses what they
         typed and hides why it failed */
      setBusy(false);
      setErr(error || "Couldn't create your account. Try again.");
      return;
    }

    onAccount(userId);
    onNext();
  };

  if (busy) {
    return (
      <View style={[styles.body, { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }]}>
        <IsoMGlow size={104} />
        <Text style={[styles.sub, { marginTop: 0 }]}>Creating your account…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { fontSize: 26 }]}>Save your plan</Text>
      <Text style={styles.sub}>Create an account so your plan, streak and history follow you to any device.</Text>

      <View style={{ marginTop: 26, gap: 10 }}>
        {/* Apple and Google need native SDKs and a development build — neither
            runs in Expo Go, so they're wired alongside that */}
        <Pressable
          onPress={() => setErr("Apple sign-up isn't wired yet — use your email for now.")}
          style={[styles.authBtn, { backgroundColor: "#FFFFFF" }]}
        >
          <Icon name="appleDark" size={20} mode="loop" />
          <Text style={[styles.authText, { color: "#0A0A0A" }]}>Continue with Apple</Text>
        </Pressable>

        <Pressable
          onPress={() => setErr("Google sign-up isn't wired yet — use your email for now.")}
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
          onChangeText={(t) => { setEmail(t); setErr(null); }}
          placeholder="name@email.com"
          placeholderTextColor={T.micro}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
        />
      </View>

      <View style={[styles.emailBox, { marginTop: 10 }]}>
        <Icon name="password" size={18} mode="loop" />
        <TextInput
          value={pw}
          onChangeText={(t) => { setPw(t); setErr(null); }}
          placeholder="Create a password"
          placeholderTextColor={T.micro}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
        />
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10}>
          {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
        </Pressable>
      </View>

      {pw.length > 0 && pw.length < 6 && (
        <Text style={styles.pwHint}>At least 6 characters.</Text>
      )}

      {err ? (
        <View style={styles.errRow}>
          <AlertTriangle size={14} color={T.red} />
          <Text style={styles.errText}>{err}</Text>
        </View>
      ) : null}

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

      <Pressable onPress={create} style={[styles.primaryBtn, { marginTop: 24 }, !ready && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ready && styles.btnTextDisabled]}>Create account</Text>
      </Pressable>

      {!agreed && <Text style={styles.agreeHint}>Tick the terms box to continue.</Text>}
    </ScrollView>
  );
}

/* ===================== YOUR WEIGHT OVER TIME ===================== */
function GraphStep({ answers, onNext }: any) {
  const { unit, cur, target, weeks, losing, maintaining } = goalTimeline(answers);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

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
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={[styles.title, { fontSize: 26 }]}>
        {maintaining ? "Your weight from here" : `Your weight over the\nnext ${weeks} ${weeks === 1 ? "week" : "weeks"}`}
      </Text>

      <View style={styles.explainCard}>
        <View style={styles.explainRow}>
          <View style={[styles.explainDash, { backgroundColor: T.green }]} />
          <Text style={styles.explainText}>
            <Text style={styles.explainLead}>With MOTION. </Text>
            {maintaining
              ? `You log every day, and your weight holds steady at ${cur} ${unit} — no creeping up, no sliding down.`
              : `You log every day, so your weight moves ${losing ? "down" : "up"} at a steady pace and settles at your goal of ${target} ${unit}.`}
          </Text>
        </View>

        <View style={styles.explainDivider} />

        <View style={styles.explainRow}>
          <View style={[styles.explainDash, { backgroundColor: "#4A4A4A" }]} />
          <Text style={[styles.explainText, { color: T.sub }]}>
            <Text style={[styles.explainLead, { color: T.sub }]}>Without tracking. </Text>
            {maintaining
              ? "The usual pattern — without keeping an eye on it, the weight slowly creeps up over the months."
              : `The usual pattern — a strong start, then it stalls, and the weight drifts back toward ${cur} ${unit}.`}
          </Text>
        </View>
      </View>

      <Animated.View style={{ marginTop: 12, opacity: fade }}>
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

      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 22 }]}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== WITH / WITHOUT HISTOGRAM ===================== */
function HistogramStep({ onNext }: { onNext: () => void }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  const withH = grow.interpolate({ inputRange: [0, 1], outputRange: [0, 168] });
  const withoutH = grow.interpolate({ inputRange: [0, 1], outputRange: [0, 66] });

  return (
    <View style={[styles.body, { flex: 1 }]}>
      <Text style={[styles.title, { fontSize: 27 }]}>You're twice as likely{"\n"}to stick with it</Text>
      <Text style={styles.sub}>People who log daily hold on to their results far longer than people who don't track at all.</Text>

      <View style={styles.histRow}>
        <View style={styles.histCol}>
          <Animated.View style={[styles.histBar, { height: withoutH, backgroundColor: "#2A2A2A" }]} />
          <Text style={styles.histLabel}>Without{"\n"}a tracker</Text>
        </View>
        <View style={styles.histCol}>
          <View style={styles.histTag}><Text style={styles.histTagText}>2× better</Text></View>
          <Animated.View style={[styles.histBar, { height: withH, backgroundColor: T.green }]} />
          <Text style={[styles.histLabel, { color: T.green }]}>With{"\n"}MOTION</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <Pressable onPress={onNext} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

/* ===================== PERSONALIZE ===================== */
function PersonalizeStep({ answers, onNext }: any) {
  const lines: string[] = [];
  if (answers.goal === "lose") lines.push("A daily calorie target set for steady weight loss");
  else if (answers.goal === "gain") lines.push("A daily calorie target set for steady gains");
  else lines.push("A daily calorie target that holds you steady");

  if (answers.workouts === "6+") lines.push("Protein raised to match your training load");
  else lines.push("A macro split matched to your body and activity");

  if (answers.burned === "yes") lines.push("Burned calories added back on the days you train");
  if ((answers.stopping || []).includes("busy")) lines.push("One-photo logging, because your schedule is full");
  if ((answers.stopping || []).includes("consistency")) lines.push("Streaks and reminders to keep you showing up");
  if ((answers.diet || "none") !== "none") lines.push("Food suggestions that respect your diet");
  if (lines.length < 4) lines.push("A plan that adjusts as you log real weigh-ins");

  return (
    <View style={[styles.body, { flex: 1 }]}>
      <Text style={[styles.title, { fontSize: 27 }]}>MOTION is built{"\n"}around you</Text>
      <Text style={styles.sub}>Here's what we're setting up from your answers.</Text>

      <View style={{ marginTop: 26, gap: 12 }}>
        {lines.slice(0, 4).map((l, k) => (
          <View key={k} style={styles.personalRow}>
            <View style={styles.personalCheck}><Check size={13} color="#0A0A0A" /></View>
            <Text style={styles.personalText}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Pressable onPress={onNext} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Build my plan</Text>
      </Pressable>
    </View>
  );
}

/* ===================== YOUR PLAN ===================== */
function PlanStep({ answers, onNext }: any) {
  const plan = buildPlan(answers);
  const unit = answers.weight?.unit || "kg";
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

      {answers.burned === "yes" && (
        <View style={styles.coachCard}>
          {/* the rainbow flame — this line is about earning more food */}
          <Icon name="flameUltimate" size={20} mode="loop" />
          <Text style={styles.coachText}>
            On days you train, MOTION adds your burned calories on top of this — so a hard session earns you a little more food.
          </Text>
        </View>
      )}

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

/* ===================== BIRTHDAY WHEEL ===================== */
const ITEM_H = 44;
const VISIBLE = 5;
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
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
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

function BirthdayStep({ step, value, onChange, onNext }: any) {
  const v = value || { m: 5, d: 14, y: 1998 };
  const monthIdx = v.m;
  const yearIdx = Math.max(0, YEARS.indexOf(v.y));
  const daysInMonth = new Date(v.y, v.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, k) => String(k + 1));
  const dayIdx = Math.min(v.d - 1, daysInMonth - 1);

  const set = (patch: any) => {
    const next = { ...v, ...patch };
    const max = new Date(next.y, next.m + 1, 0).getDate();
    if (next.d > max) next.d = max;
    onChange(next);
  };

  return (
    <View style={[styles.body, { flex: 1 }]}>
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}
      <View style={styles.wheelWrap}>
        <View style={styles.wheelBand} pointerEvents="none" />
        <View style={styles.wheelRow}>
          <WheelColumn data={MONTHS} index={monthIdx} onIndex={(k) => set({ m: k })} width={128} />
          <WheelColumn data={days} index={dayIdx} onIndex={(k) => set({ d: k + 1 })} width={64} />
          <WheelColumn data={YEARS.map(String)} index={yearIdx} onIndex={(k) => set({ y: YEARS[k] })} width={84} />
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={onNext} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

/* ===================== UNIT TOGGLE ===================== */
function UnitToggle({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.unitToggle}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onPick(o)} style={[styles.unitPill, on && styles.unitPillOn]}>
            <Text style={[styles.unitPillText, on && styles.unitPillTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ===================== HEIGHT =====================
   No hero icon here. These two screens are a number and a keyboard — an icon
   above them adds nothing and pushes the input further from the thumb. */
function HeightStep({ step, value, onChange, onNext }: any) {
  const v = value || { unit: "cm", cm: "", ft: "", inch: "" };
  const set = (patch: any) => onChange({ ...v, ...patch });

  const cmNum = parseFloat(v.cm);
  const ftNum = parseFloat(v.ft);
  const inNum = parseFloat(v.inch || "0");

  let ok = false;
  let warn = "";
  if (v.unit === "cm") {
    ok = !isNaN(cmNum) && cmNum >= 90 && cmNum <= 250;
    if (v.cm.length > 0 && !ok) warn = "Enter a height between 90 and 250 cm.";
  } else {
    const totalIn = (isNaN(ftNum) ? 0 : ftNum) * 12 + (isNaN(inNum) ? 0 : inNum);
    ok = !isNaN(ftNum) && totalIn >= 36 && totalIn <= 98;
    if (v.ft.length > 0 && !ok) warn = "Enter a height between 3'0\" and 8'2\".";
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}

      <UnitToggle options={["cm", "ft + in"]} value={v.unit === "cm" ? "cm" : "ft + in"} onPick={(u) => set({ unit: u === "cm" ? "cm" : "ft" })} />

      {v.unit === "cm" ? (
        <View style={styles.entryRow}>
          <TextInput value={v.cm} onChangeText={(t) => set({ cm: t.replace(/[^0-9.]/g, "") })} keyboardType="number-pad" placeholder="175" placeholderTextColor={T.micro} style={styles.bigInput} maxLength={3} />
          <Text style={styles.entryUnit}>cm</Text>
        </View>
      ) : (
        <View style={styles.entryRow}>
          <TextInput value={v.ft} onChangeText={(t) => set({ ft: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="5" placeholderTextColor={T.micro} style={[styles.bigInput, { minWidth: 62 }]} maxLength={1} />
          <Text style={styles.entryUnit}>ft</Text>
          <TextInput value={v.inch} onChangeText={(t) => set({ inch: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="9" placeholderTextColor={T.micro} style={[styles.bigInput, { minWidth: 62, marginLeft: 14 }]} maxLength={2} />
          <Text style={styles.entryUnit}>in</Text>
        </View>
      )}

      {warn ? (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.warnText}>{warn}</Text>
        </View>
      ) : null}

      <Pressable onPress={ok ? onNext : undefined} style={[styles.primaryBtn, { marginTop: 30 }, !ok && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ok && styles.btnTextDisabled]}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== WEIGHT ===================== */
function WeightStep({ step, value, onChange, onNext }: any) {
  const v = value || { unit: "kg", val: "" };
  const set = (patch: any) => onChange({ ...v, ...patch });

  const n = parseFloat(v.val);
  const min = v.unit === "kg" ? 25 : 55;
  const max = v.unit === "kg" ? 300 : 660;
  const ok = !isNaN(n) && n >= min && n <= max;
  const warn = v.val.length > 0 && !ok
    ? `Please enter your real weight — this shapes your whole plan. Expected between ${min} and ${max} ${v.unit}.`
    : "";

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}

      <UnitToggle options={["kg", "lbs"]} value={v.unit} onPick={(u) => set({ unit: u })} />

      <View style={styles.entryRow}>
        <TextInput value={v.val} onChangeText={(t) => set({ val: t.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" placeholder={v.unit === "kg" ? "78" : "172"} placeholderTextColor={T.micro} style={styles.bigInput} maxLength={5} />
        <Text style={styles.entryUnit}>{v.unit}</Text>
      </View>

      {warn ? (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#FBBF24" />
          <Text style={styles.warnText}>{warn}</Text>
        </View>
      ) : null}

      <Pressable onPress={ok ? onNext : undefined} style={[styles.primaryBtn, { marginTop: 30 }, !ok && styles.btnDisabled]}>
        <Text style={[styles.primaryBtnText, !ok && styles.btnTextDisabled]}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ===================== DESIRED WEIGHT =====================
   A target that contradicts the stated goal is a HARD BLOCK, not a note —
   letting it through would make the plan, the timeline and the graph all
   disagree with each other. */
function DesiredStep({ step, value, current, goal, onChange, onNext }: any) {
  const unit = current?.unit || "kg";
  const cur = parseFloat(current?.val) || (unit === "kg" ? 78 : 172);
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
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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

/* ===================== GOAL DATE ===================== */
function GoalDateStep({ answers, onNext }: any) {
  const { unit, target, rate, diff, weeks, losing, maintaining } = goalTimeline(answers);
  const td = new Date();
  td.setDate(td.getDate() + weeks * 7);
  const dateLabel = `${MONTHS_SHORT[td.getMonth()]} ${td.getDate()}, ${td.getFullYear()}`;

  return (
    <View style={[styles.body, { flex: 1 }]}>
      <Text style={[styles.title, { fontSize: 26 }]}>
        {maintaining ? "You're already there" : `You'll reach ${target} ${unit} by`}
      </Text>
      {!maintaining && <Text style={styles.goalDate}>{dateLabel}</Text>}

      <View style={{ marginTop: 22 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 18 }}>
            <View style={styles.goalRow}>
              <Icon
                name={maintaining ? "goalFlat" : losing ? "goalChartDown" : "goalChartUp"}
                size={22}
                mode="loop"
              />
              <Text style={styles.goalRowText}>
                {maintaining
                  ? "Your plan will hold you steady at your current weight."
                  : `${diff.toFixed(1)} ${unit} to ${losing ? "lose" : "gain"}, at about ${rate.toFixed(2)} ${unit} a week.`}
              </Text>
            </View>
            <View style={[styles.goalRow, { marginTop: 12 }]}>
              <Icon name="accomplishCalendar" size={22} mode="loop" />
              <Text style={styles.goalRowText}>
                That's roughly {weeks} {weeks === 1 ? "week" : "weeks"} of steady logging. MOTION keeps you on pace.
              </Text>
            </View>
          </View>
        </TravelBorder>
      </View>

      <Text style={[styles.sub, { marginTop: 18 }]}>
        This is an estimate based on what you've told us. Your plan updates as you log real weigh-ins.
      </Text>

      <View style={{ flex: 1 }} />
      <Pressable onPress={onNext} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

/* ===================== SHARED STEPS =====================
   A choice's icon comes from whichever source suits it: an animation, a
   sheened Lucide icon, a component of its own, or nothing at all when the
   screen is deliberately plain. The sheen is staggered by row so a list
   doesn't sweep in lockstep. */
function ChoiceIcon({ c, idx }: { c: Choice; idx: number }) {
  if (!c.icon && !c.lucide && !c.custom) return null;
  const Custom = c.custom;
  return (
    <View style={styles.choiceIcon}>
      {c.icon ? (
        <Icon name={c.icon} size={23} mode="loop" />
      ) : Custom ? (
        <Custom size={24} />
      ) : (
        <SheenIcon icon={c.lucide} size={20} color={c.lucideColor} delay={idx * 240} />
      )}
    </View>
  );
}

function SingleStep({ step, value, onPick }: any) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}
      <View style={{ marginTop: 24, gap: 10 }}>
        {step.choices.map((c: Choice, idx: number) => {
          const on = value === c.key;
          return (
            <Pressable key={c.key} onPress={() => onPick(c.key)} style={[styles.choice, on && styles.choiceOn]}>
              <ChoiceIcon c={c} idx={idx} />
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

function MultiStep({ step, value, onChange, onNext }: any) {
  const toggle = (k: string) => value.includes(k) ? onChange(value.filter((x: string) => x !== k)) : onChange([...value, k]);
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.title}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}
      <View style={{ marginTop: 24, gap: 10 }}>
        {step.choices.map((c: Choice, idx: number) => {
          const on = value.includes(c.key);
          return (
            <Pressable key={c.key} onPress={() => toggle(c.key)} style={[styles.choice, on && styles.choiceOn]}>
              <ChoiceIcon c={c} idx={idx} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceLabel, on && { color: T.green }]}>{c.label}</Text>
                {c.sub ? <Text style={styles.choiceSub}>{c.sub}</Text> : null}
              </View>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <Check size={13} color="#0A0A0A" />}</View>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 24 }]}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

function MessageStep({ step, onNext }: any) {
  return (
    <View style={[styles.body, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
      <Text style={[styles.title, { textAlign: "center", fontSize: 26 }]}>{step.title}</Text>
      {step.sub ? <Text style={[styles.sub, { textAlign: "center", marginTop: 12, lineHeight: 22 }]}>{step.sub}</Text> : null}
      <Pressable onPress={onNext} style={[styles.primaryBtn, { marginTop: 32, alignSelf: "stretch" }]}>
        <Text style={styles.primaryBtnText}>{step.cta}</Text>
      </Pressable>
    </View>
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

/* ===================== TRIAL PAYWALL =====================
   Every feature carries the icon it maps to in the app, so the list reads as
   "these exact things" rather than generic ticks.
   The PLANS are shown but not required: whichever is selected is what the
   trial rolls into on day 4. NO CARD FORM — on iOS, subscriptions must go
   through Apple's IAP sheet, so "Start free trial" hands off to StoreKit and
   Apple charges the card already on the user's Apple ID. There is no screen
   for us to build there; `onStartTrial` becomes the StoreKit call. */
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

  codeInput: { fontSize: 26, color: T.text, fontFamily: FONTS.heading, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 18, textAlign: "center", letterSpacing: 3, marginTop: 28 },

  authBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 15 },
  authDim: { opacity: 0.45 },
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
  errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

  explainCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 16, marginTop: 20 },
  explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  explainDash: { width: 20, height: 4, borderRadius: 2, marginTop: 6 },
  explainText: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: FONTS.body, lineHeight: 18.5 },
  explainLead: { fontFamily: FONTS.heading, color: T.green },
  explainDivider: { height: 1, backgroundColor: T.border, marginVertical: 13 },
  chartAxisTitle: { fontSize: 9, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, marginBottom: 2 },

  histRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 40, marginTop: 40, height: 250 },
  histCol: { alignItems: "center" },
  histBar: { width: 78, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  histLabel: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed, textAlign: "center", marginTop: 12, lineHeight: 17 },
  histTag: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 8 },
  histTagText: { fontSize: 11, color: T.green, fontFamily: FONTS.heading },

  personalRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 15 },
  personalCheck: { width: 22, height: 22, borderRadius: 7, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  personalText: { flex: 1, fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 19 },

  planCalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  planCal: { fontSize: 46, color: T.text, fontFamily: FONTS.heading },
  planCalUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
  macroTiles: { flexDirection: "row", gap: 8, marginTop: 18 },
  macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  macroTileNum: { fontSize: 17, fontFamily: FONTS.heading },
  macroTileLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3, textTransform: "uppercase" },
  coachCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 14, padding: 14, marginTop: 14 },
  coachText: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: FONTS.body, lineHeight: 18 },

  wheelWrap: { marginTop: 34, alignItems: "center", justifyContent: "center", position: "relative" },
  wheelBand: { position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, borderRadius: 12, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, zIndex: 0 },
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  wheelCell: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelItem: { fontSize: 17, color: T.micro, fontFamily: FONTS.body },
  wheelItemOn: { color: T.text, fontFamily: FONTS.heading, fontSize: 18.5 },

  unitToggle: { flexDirection: "row", gap: 6, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 4, marginTop: 26, alignSelf: "flex-start" },
  unitPill: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 9 },
  unitPillOn: { backgroundColor: T.green },
  unitPillText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  unitPillTextOn: { color: "#0A0A0A" },
  entryRow: { flexDirection: "row", alignItems: "baseline", marginTop: 30 },
  bigInput: { fontSize: 54, color: T.text, fontFamily: FONTS.heading, minWidth: 130, padding: 0, borderBottomWidth: 2, borderBottomColor: T.greenBorder, textAlign: "center" },
  entryUnit: { fontSize: 20, color: T.sub, fontFamily: FONTS.body, marginLeft: 10 },
  warnRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 20, backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", borderRadius: 12, padding: 12 },
  noteRowOk: { backgroundColor: T.greenBg, borderColor: T.greenBorder },
  warnText: { flex: 1, fontSize: 12.5, color: "#FBBF24", fontFamily: FONTS.body, lineHeight: 18 },
  currentChip: { alignSelf: "flex-start", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, marginTop: 22 },
  currentChipText: { fontSize: 12, color: T.sub, fontFamily: FONTS.bodyMed },
  btnDisabled: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
  btnTextDisabled: { color: T.micro },

  goalDate: { fontSize: 34, color: T.green, fontFamily: FONTS.heading, marginTop: 6 },
  goalRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  goalRowText: { flex: 1, fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 20 },

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