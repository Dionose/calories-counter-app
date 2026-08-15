// app/onboarding.tsx
import { useRouter } from "expo-router";
import { Check, ChevronLeft, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../components/TravelBorder";
import { useApp } from "../constants/AppState";
import { DARK, FONTS } from "../constants/theme";

const T = DARK;

// ---------- question data ----------
type Choice = { key: string; label: string; sub?: string };
type Step =
  | { kind: "single"; id: string; title: string; sub?: string; choices: Choice[] }
  | { kind: "multi"; id: string; title: string; sub?: string; choices: Choice[] }
  | { kind: "message"; id: string; title: string; sub?: string; cta: string }
  | { kind: "building"; id: string; title: string; sub?: string }
  | { kind: "paywall"; id: string };

const STEPS: Step[] = [
  { kind: "message", id: "welcome", title: "Welcome to MOTION", sub: "Track calories in seconds with a photo. Let's set up your plan — takes about a minute.", cta: "Get started" },
  { kind: "single", id: "sex", title: "What's your sex?", sub: "We use this to estimate your calorie needs.", choices: [
    { key: "male", label: "Male" }, { key: "female", label: "Female" }, { key: "other", label: "Prefer not to say" },
  ]},
  { kind: "single", id: "goal", title: "What's your goal?", choices: [
    { key: "lose", label: "Lose weight" }, { key: "maintain", label: "Maintain" }, { key: "gain", label: "Gain weight" },
  ]},
  { kind: "single", id: "activity", title: "How active are you?", sub: "Outside of workouts, day to day.", choices: [
    { key: "low", label: "Little to no exercise" },
    { key: "light", label: "Light — 1–3 days/week" },
    { key: "mod", label: "Moderate — 3–5 days/week" },
    { key: "high", label: "Very active — 6–7 days/week" },
  ]},
  { kind: "single", id: "pace", title: "How fast do you want to go?", sub: "You can change this anytime.", choices: [
    { key: "slow", label: "Steady", sub: "Slow & sustainable" },
    { key: "mod", label: "Balanced", sub: "Our recommendation" },
    { key: "fast", label: "Aggressive", sub: "Faster results" },
  ]},
  { kind: "single", id: "diet", title: "Do you follow a specific diet?", choices: [
    { key: "none", label: "No specific diet" },
    { key: "balanced", label: "Balanced" },
    { key: "wholefood", label: "Wholefood" },
    { key: "lowcarb", label: "Low carb" },
    { key: "keto", label: "Keto" },
    { key: "vegetarian", label: "Vegetarian" },
    { key: "vegan", label: "Vegan" },
    { key: "pescatarian", label: "Pescatarian" },
  ]},
  { kind: "multi", id: "accomplish", title: "What would you like to accomplish?", sub: "Pick all that apply.", choices: [
    { key: "healthier", label: "Eat healthier" },
    { key: "energy", label: "Boost my energy" },
    { key: "body", label: "Feel better about my body" },
    { key: "consistent", label: "Stay consistent" },
  ]},
  { kind: "single", id: "heard", title: "Where did you hear about us?", choices: [
    { key: "tv", label: "TV" }, { key: "youtube", label: "YouTube" }, { key: "google", label: "Google" },
    { key: "facebook", label: "Facebook" }, { key: "x", label: "X" }, { key: "tiktok", label: "TikTok" },
    { key: "instagram", label: "Instagram" }, { key: "appstore", label: "App Store" },
    { key: "friends", label: "Friends / Family" }, { key: "other", label: "Other" },
  ]},
  { kind: "message", id: "crush", title: "You've got real potential to crush this 💪", sub: "People with a clear plan are 3× more likely to hit their goal. You're already ahead.", cta: "Let's build my plan" },
  { kind: "building", id: "building", title: "Building your plan", sub: "Crunching your numbers…" },
  { kind: "message", id: "thanks", title: "Thank you for trusting us 🤝", sub: "Your personalised plan is ready. Here's what we recommend for you.", cta: "See my plan" },
  { kind: "paywall", id: "paywall" },
];

export default function Onboarding() {
  const router = useRouter();
  const { setIsPro } = useApp();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const step = STEPS[i];
  const total = STEPS.length;

  const goNext = () => {
    if (i < total - 1) setI(i + 1);
    else finish(false);
  };
  const goBack = () => { if (i > 0) setI(i - 1); };

  const finish = (pro: boolean) => {
    setIsPro(pro);           // start trial = Pro; skip = free
    router.replace("/(tabs)"); // into the app
  };

  // auto-advance the "building your plan" step
  React.useEffect(() => {
    if (step.kind === "building") {
      const t = setTimeout(() => setI((x) => x + 1), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  const pct = ((i + 1) / total) * 100;

  return (
    <View style={styles.screen}>
      {/* top bar: back + progress */}
      <View style={styles.topBar}>
        {i > 0 && step.kind !== "building" ? (
          <Pressable onPress={goBack} hitSlop={10}><ChevronLeft size={24} color={T.text} /></Pressable>
        ) : <View style={{ width: 24 }} />}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      {step.kind === "single" && <SingleStep step={step} value={answers[step.id]} onPick={(k: string) => { setAnswers({ ...answers, [step.id]: k }); setTimeout(goNext, 180); }} />}
      {step.kind === "multi" && <MultiStep step={step} value={answers[step.id] || []} onChange={(v: string[]) => setAnswers({ ...answers, [step.id]: v })} onNext={goNext} />}
      {step.kind === "message" && <MessageStep step={step} onNext={goNext} />}
      {step.kind === "building" && <BuildingStep step={step} />}
      {step.kind === "paywall" && <TrialPaywall onStartTrial={() => finish(true)} onSkip={() => finish(false)} />}
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
        {step.choices.map((c: Choice) => {
          const on = value.includes(c.key);
          return (
            <Pressable key={c.key} onPress={() => toggle(c.key)} style={[styles.choice, on && styles.choiceOn]}>
              <Text style={[styles.choiceLabel, on && { color: T.green }]}>{c.label}</Text>
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
      <Spinner />
      <Text style={[styles.title, { textAlign: "center", marginTop: 24, fontSize: 22 }]}>{step.title}</Text>
      <Text style={[styles.sub, { textAlign: "center", marginTop: 8 }]}>{step.sub}</Text>
    </View>
  );
}

function TrialPaywall({ onStartTrial, onSkip }: { onStartTrial: () => void; onSkip: () => void }) {
  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]}>
      <Text style={[styles.title, { fontSize: 26 }]}>Start your 3-day free trial</Text>
      <Text style={[styles.sub, { marginTop: 8 }]}>Then $9.99 US/month. Cancel anytime before day 4 and you won't be charged.</Text>

      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 18, gap: 12 }}>
          {[
            "Unlimited photo logging",
            "Motion Voice AI — describe meals, no typing",
            "Barcode scanner for exact facts",
            "Full history & tier colours",
            "Leaderboard & streak badges",
          ].map((f: string, k: number) => (
            <View key={k} style={styles.featureRow}>
              <View style={styles.featureCheck}><Check size={13} color="#0A0A0A" /></View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </TravelBorder>

      <View style={styles.trialTimeline}>
        <Sparkles size={13} color={T.green} />
        <Text style={styles.trialTimelineText}>Today: full access · Day 3: reminder · Day 4: $9.99 US/month begins unless you cancel</Text>
      </View>

      <Pressable onPress={onStartTrial} style={[styles.primaryBtn, { marginTop: 20 }]}>
        <Text style={styles.primaryBtnText}>Start free trial</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={styles.skipText}>Maybe later — continue with the free plan</Text>
      </Pressable>
    </ScrollView>
  );
}

function Spinner() {
  const spin = React.useRef(new (require("react-native").Animated).Value(0)).current;
  React.useEffect(() => {
    const { Animated, Easing } = require("react-native");
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const { Animated } = require("react-native");
  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: T.green, borderRadius: 99 },

  body: { padding: 24, paddingTop: 16 },
  title: { fontSize: 24, color: T.text, fontFamily: FONTS.heading },
  sub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body, marginTop: 8, lineHeight: 20 },

  choice: { flexDirection: "row", alignItems: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16 },
  choiceOn: { borderColor: T.green, backgroundColor: T.greenBg },
  choiceLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
  choiceSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: T.green, borderColor: T.green },

  primaryBtn: { backgroundColor: T.green, borderRadius: 14, padding: 16, alignItems: "center" },
  primaryBtnText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 15 },
  skipText: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

  spinner: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: T.greenBg, borderTopColor: T.green },

  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureCheck: { width: 22, height: 22, borderRadius: 7, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 13.5, color: T.text, fontFamily: FONTS.body },

  trialTimeline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: T.cardHi, borderRadius: 12, padding: 12 },
  trialTimelineText: { flex: 1, fontSize: 11, color: T.sub, fontFamily: FONTS.body },
});