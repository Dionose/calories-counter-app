// components/GoalScreens.tsx
// The four Goals editors from Profile: Goal, Daily calories, Target weight,
// Units & height.
//
// ⚠️ THE GOAL FLOW ASKS THE SAME QUESTIONS AS ONBOARDING, AND USES THE SAME
// MATHS. That sounds obvious and it wasn't true: when onboarding was cut from
// twenty-eight screens to fifteen, the duplicate workouts-per-week question
// was dropped there and left here — along with the WORKOUT_BUMP it fed into.
//
// So the same person, answering identically, got a different daily target
// depending on which screen built it. Up to 0.1 on the multiplier, roughly
// 150 calories, silently. Two screens computing one number two ways is
// exactly the disagreement that cut was meant to remove.
//
// It's three questions now — goal, pace, activity — and the multiplier is the
// activity factor alone, matching buildPlan() in onboarding line for line. If
// one of them changes, the other has to change with it.
import { Check, Flame, Minus, Plus, Ruler, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS, tierForStreak } from "../constants/theme";
import BackRow from "./BackRow";
import IsoM from "./IsoM";
import SaveBtn from "./SaveBtn";
import Tap from "./Tap";
import Toggle from "./Toggle";
import TravelBorder from "./TravelBorder";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* the same rates onboarding uses — kg per week */
const PACE_RATE: Record<string, number> = { slow: 0.25, mod: 0.5, fast: 0.75 };

/* AND THE SAME MULTIPLIERS. There used to be a WORKOUT_BUMP added on top of
   these; it's gone, because onboarding never had one. See the note at the top
   of the file. */
const ACTIVITY_MULT: Record<string, number> = { low: 1.2, light: 1.375, mod: 1.55, high: 1.725 };

/** Mifflin-St Jeor — what your body burns at rest.
    Computed FRESH from the body every time. The earlier version tried to
    recover BMR by dividing the stored TDEE by an assumed multiplier, which
    only holds if you'd previously answered "moderate / 3-5". Any other answer
    made the derived BMR wrong, and since each rebuild fed on the last one's
    TDEE the number climbed every time you touched the screen. */
function bmrFor(weightKg: number, heightCm: number, age: number, sex: "male" | "female") {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "female" ? base - 161 : base + 5;
}

function ageFrom(day: number, month: number, year: number) {
  const now = new Date();
  let a = now.getFullYear() - year;
  const had = now.getMonth() > month || (now.getMonth() === month && now.getDate() >= day);
  if (!had) a -= 1;
  return Math.max(13, a);
}

/* ---------- a shared +/- stepper ---------- */
function Stepper({
  value, unit, onDec, onInc,
}: {
  value: string;
  unit: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <View style={s.stepperRow}>
      <Pressable onPress={() => { H.tick(); onDec(); }} style={s.stepBtn} hitSlop={8}>
        <Minus size={19} color={T.text} />
      </Pressable>

      <View style={s.stepValue}>
        <Text style={s.stepNum}>{value}</Text>
        <Text style={s.stepUnit}>{unit}</Text>
      </View>

      <Pressable onPress={() => { H.tick(); onInc(); }} style={s.stepBtn} hitSlop={8}>
        <Plus size={19} color={T.text} />
      </Pressable>
    </View>
  );
}

/* ---------- a choice list, used by every question in the Goal flow ---------- */
function Choices({
  options, value, onPick,
}: {
  options: { key: string; label: string; sub?: string }[];
  value: string;
  onPick: (k: string) => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <View style={{ gap: 10, marginTop: 18 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Tap key={o.key} onPress={() => { H.tap(); onPick(o.key); }}>
            <View style={[s.choice, on && { borderColor: T.green, backgroundColor: T.greenBg }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.choiceLabel, on && { color: T.green }]}>{o.label}</Text>
                {o.sub ? <Text style={s.choiceSub}>{o.sub}</Text> : null}
              </View>
              {on && <Check size={18} color={T.green} />}
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

/* ================= GOAL ================= */
type GoalStep = "goal" | "pace" | "activity" | "building" | "done";

export function GoalScreen({ onBack }: { onBack: () => void }) {
  const { T, profile, plan, savePlan, streakDays, freeLocked } = useApp();
  const s = styles(T);
  const tier = tierForStreak(streakDays);

  const [step, setStep] = useState<GoalStep>("goal");
  const [goal, setGoal] = useState(profile.goal);
  const [pace, setPace] = useState<"slow" | "mod" | "fast">(
    profile.paceRate <= 0.3 ? "slow" : profile.paceRate >= 0.7 ? "fast" : "mod"
  );

  /* ⚠️ SEEDED FROM WHAT THEY ACTUALLY SAVED. This used to start at "mod" every
     time, whatever the profile said — so someone who told onboarding "mostly
     sitting" opened this screen, saw "moderately active" already selected,
     tapped through, and walked out with a target 400 calories higher than
     they should have. They never chose it; the screen chose for them and
     called it their answer.

     Falls back to "mod" only when nothing was ever saved. */
  const [activity, setActivity] = useState<string>(profile.activity || "mod");

  const [before] = useState(plan.calories);   // frozen so "from before" stays honest
  const [newCal, setNewCal] = useState(plan.calories);

  const goalWord = goal === "lose" ? "weight loss" : goal === "gain" ? "muscle gain" : "maintenance";

  /* Rebuild the target from the body, not from the previous plan — see bmrFor.
     Weight is stored in the user's unit, so convert to kg for the formula. */
  const rebuild = async () => {
    setStep("building");
    await sleep(1800);

    const kg = profile.weightUnit === "kg" ? profile.startWeight : profile.startWeight / 2.20462;
    const age = ageFrom(profile.dobDay, profile.dobMonth, profile.dobYear);
    const bmr = bmrFor(kg, profile.heightCm || 175, age, profile.sex || "male");

    /* ONE MULTIPLIER, exactly as onboarding does it */
    const mult = ACTIVITY_MULT[activity] || 1.375;
    const tdee = Math.round(bmr * mult);

    const rate = PACE_RATE[pace];
    const shift = (rate * 7700) / 7;
    let target = tdee;
    if (goal === "lose") target = tdee - shift;
    if (goal === "gain") target = tdee + shift;

    const floor = (profile.sex || "male") === "female" ? 1200 : 1500;
    const calories = Math.round(Math.max(floor, target) / 10) * 10;

    const protein = Math.round(kg * 1.8);
    const fat = Math.round((calories * 0.25) / 9);
    const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

    savePlan(
      { calories, protein, carbs, fat, tdee, addBurned: plan.addBurned },
      /* ACTIVITY IS SAVED TOO, so the next visit opens on what they picked
         rather than starting from a default again */
      { goal, paceRate: rate, activity } as any
    );
    setNewCal(calories);
    H.success();
    setStep("done");
  };

  if (step === "building") {
    return (
      <View style={s.centre}>
        <IsoM size={84} color={freeLocked ? T.green : tier.color} />
        <Text style={s.buildingText}>
          Rebuilding your <Text style={{ color: T.green }}>{goalWord}</Text> plan…
        </Text>
      </View>
    );
  }

  if (step === "done") {
    const diff = newCal - before;
    return (
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Your new plan" onBack={onBack} />

        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 20 }}>
            <Text style={s.micro}>DAILY CALORIES</Text>
            <View style={s.bigRow}>
              <Text style={s.bigNum}>{newCal.toLocaleString()}</Text>
              <Text style={s.bigUnit}>cal a day</Text>
            </View>
            {diff !== 0 && (
              <View style={s.diffRow}>
                {diff > 0 ? <TrendingUp size={13} color={T.green} /> : <TrendingDown size={13} color={T.orange} />}
                <Text style={[s.diffText, { color: diff > 0 ? T.green : T.orange }]}>
                  {diff > 0 ? "+" : ""}{diff} from {before.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </TravelBorder>

        {/* without this, Home showing a bigger number looks like a bug */}
        {plan.addBurned && (
          <View style={s.infoCard}>
            <Flame size={14} color={T.green} />
            <Text style={s.infoText}>
              That's your base target. On days you train, MOTION adds your burned calories on top — so
              Home will show more than this.
            </Text>
          </View>
        )}

        <Text style={s.doneNote}>
          Home, Calendar and Stats all follow this number, so they've updated too.
        </Text>

        <Tap onPress={onBack} style={{ marginTop: 20 }}>
          <View style={s.primary}>
            <Text style={s.primaryText}>Done</Text>
          </View>
        </Tap>
      </ScrollView>
    );
  }

  if (step === "goal") {
    return (
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Your goal" onBack={onBack} />
        <Text style={s.qCount}>Question 1 of 3</Text>
        <Text style={s.question}>What are you working toward?</Text>
        <Text style={s.note}>
          This sets the direction of your whole plan. Changing it rebuilds your daily target.
        </Text>

        <Choices
          value={goal}
          onPick={(k) => { setGoal(k as any); setTimeout(() => setStep("pace"), 200); }}
          options={[
            { key: "lose", label: "Lose weight", sub: "Eat a little under what you burn" },
            { key: "maintain", label: "Maintain", sub: "Hold steady where you are" },
            { key: "gain", label: "Gain weight", sub: "Eat a little over what you burn" },
          ]}
        />
      </ScrollView>
    );
  }

  if (step === "pace") {
    const maintaining = goal === "maintain";
    return (
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Your goal" onBack={() => setStep("goal")} />
        <Text style={s.qCount}>Question 2 of 3</Text>
        <Text style={s.question}>
          {maintaining ? "How strictly do you want to hold?" : "How fast do you want to go?"}
        </Text>
        <Text style={s.note}>
          {maintaining
            ? "This sets how much room your daily target leaves either side."
            : "Faster means a bigger daily gap. Steady is easier to keep up for months."}
        </Text>

        <Choices
          value={pace}
          onPick={(k) => { setPace(k as any); setTimeout(() => setStep("activity"), 200); }}
          options={[
            { key: "slow", label: "Steady", sub: "0.25 kg a week · slow & sustainable" },
            { key: "mod", label: "Balanced", sub: "0.5 kg a week · our recommendation" },
            { key: "fast", label: "Aggressive", sub: "0.75 kg a week · faster results" },
          ]}
        />
      </ScrollView>
    );
  }

  /* ---------- activity — the LAST question now ----------
     The wording matches onboarding's, including the workout counts folded into
     the sub-lines. That's how one question can carry what used to be two:
     someone who trains four times a week and someone on their feet all day
     land on the same multiplier, which is what the formula actually wants. */
  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Your goal" onBack={() => setStep("pace")} />
      <Text style={s.qCount}>Question 3 of 3</Text>
      <Text style={s.question}>How active are you?</Text>
      <Text style={s.note}>
        Day to day, counting work and everything else — not just the gym. This is the biggest single
        factor in what your body burns.
      </Text>

      <Choices
        value={activity}
        onPick={setActivity}
        options={[
          { key: "low", label: "Mostly sitting", sub: "Desk job, little exercise" },
          { key: "light", label: "Lightly active", sub: "On your feet some of the day, or 1–3 workouts a week" },
          { key: "mod", label: "Moderately active", sub: "Moving most of the day, or 3–5 workouts a week" },
          { key: "high", label: "Very active", sub: "Physical job, or training 6–7 days a week" },
        ]}
      />

      <Tap onPress={rebuild} style={{ marginTop: 24 }}>
        <View style={s.primary}>
          <Text style={s.primaryText}>Rebuild my plan</Text>
        </View>
      </Tap>
    </ScrollView>
  );
}

/* ================= DAILY CALORIES ================= */
export function CaloriesScreen({ onBack }: { onBack: () => void }) {
  const { T, plan, setDailyCalories, resetToRecommended, recommendedCalories, updatePlanFlag } = useApp();
  const s = styles(T);
  const [cal, setCal] = useState(plan.calories);
  const [saved, setSaved] = useState(false);
  const [reset, setReset] = useState(false);

  const changed = cal !== recommendedCalories;

  const save = () => {
    H.success();
    setSaved(true);
    setDailyCalories(cal);
    setTimeout(onBack, 750);
  };

  const doReset = () => {
    H.tap();
    setCal(recommendedCalories);
    resetToRecommended();
    setReset(true);
    setTimeout(() => setReset(false), 1200);
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Daily calories" onBack={onBack} />
      <Text style={s.note}>
        Your daily target — the number Home counts down from. Each tap moves it by 10.
      </Text>

      <View style={s.card}>
        <Text style={[s.micro, { textAlign: "center", marginBottom: 4 }]}>Daily goal</Text>
        <Stepper
          value={cal.toLocaleString()}
          unit="cal"
          onDec={() => setCal((c) => Math.max(1200, c - 10))}
          onInc={() => setCal((c) => Math.min(6000, c + 10))}
        />
        {changed && (
          <Text style={s.recommendNote}>
            MOTION recommended {recommendedCalories.toLocaleString()}
          </Text>
        )}
      </View>

      {/* ---------- ADD BURNED CALORIES ----------
          THE ONLY PLACE THIS CAN BE TURNED ON now that onboarding doesn't ask.
          It defaults to off, which is the right default for something
          confusing to be asked about before you've used the app once — but it
          means Home's burned-calorie code sits dormant until someone finds
          this toggle. Worth remembering if that feature ever looks dead. */}
      <View style={[s.card, { marginTop: 12, padding: 0 }]}>
        <View style={s.burnedRow}>
          <View style={s.unitIcon}>
            <Flame size={16} color={plan.addBurned ? T.green : T.micro} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.unitLabel}>Add burned calories back</Text>
            <Text style={s.burnedSub}>
              {plan.addBurned
                ? "Training days give you more to eat"
                : "Same target every day, whatever you burn"}
            </Text>
          </View>
          <Toggle
            value={plan.addBurned}
            onValueChange={(v) => { if (v) H.tap(); updatePlanFlag("addBurned", v); }}
          />
        </View>
      </View>

      <SaveBtn saved={saved} onPress={save} />

      <Tap onPress={doReset} style={{ marginTop: 10 }}>
        <View style={[s.secondary, reset && { borderColor: T.greenBorder }]}>
          <Text style={[s.secondaryText, reset && { color: T.green }]}>
            {reset ? "Reset to recommended ✓" : "Reset to recommended"}
          </Text>
        </View>
      </Tap>

      <Text style={s.foot}>
        Your macros are worked out from this number, so they move with it.
      </Text>
    </ScrollView>
  );
}

/* ================= TARGET WEIGHT ================= */
export function TargetWeightScreen({ onBack }: { onBack: () => void }) {
  const { T, profile, updateProfile } = useApp();
  const s = styles(T);
  const unit = profile.weightUnit;
  const [tw, setTw] = useState(profile.targetWeight);
  const [saved, setSaved] = useState(false);

  const step = unit === "kg" ? 0.5 : 1;
  const current = profile.startWeight;
  const diff = tw - current;
  const losing = diff < 0;

  // how long at their current pace
  const rate = unit === "kg" ? profile.paceRate : profile.paceRate * 2.20462;
  const weeks = Math.abs(diff) < 0.05 ? 0 : Math.max(1, Math.ceil(Math.abs(diff) / rate));

  // does the target contradict the goal they've set?
  const contradicts =
    (profile.goal === "lose" && diff >= 0) || (profile.goal === "gain" && diff <= 0);

  const save = () => {
    H.success();
    setSaved(true);
    updateProfile({ targetWeight: +tw.toFixed(1), goalWeeks: weeks });
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Target weight" onBack={onBack} />

      <View style={s.currentChip}>
        <Text style={s.currentChipText}>Right now: {current} {unit}</Text>
      </View>

      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={[s.micro, { textAlign: "center", marginBottom: 4 }]}>Target weight</Text>
        <Stepper
          value={tw.toFixed(1)}
          unit={unit}
          onDec={() => setTw((v) => +(v - step).toFixed(1))}
          onInc={() => setTw((v) => +(v + step).toFixed(1))}
        />
      </View>

      {contradicts ? (
        <View style={s.warnCard}>
          <Text style={s.warnText}>
            Your goal is to {profile.goal === "lose" ? "lose" : "gain"} weight, so your target should be{" "}
            {profile.goal === "lose" ? "below" : "above"} {current} {unit}. Change it here, or change
            your goal first.
          </Text>
        </View>
      ) : weeks > 0 ? (
        <View style={s.infoCard}>
          {losing ? <TrendingDown size={14} color={T.green} /> : <TrendingUp size={14} color={T.green} />}
          <Text style={s.infoText}>
            {Math.abs(diff).toFixed(1)} {unit} to {losing ? "lose" : "gain"} · about {weeks}{" "}
            {weeks === 1 ? "week" : "weeks"} at your pace
          </Text>
        </View>
      ) : (
        <View style={s.infoCard}>
          <Check size={14} color={T.green} />
          <Text style={s.infoText}>That's where you are now — you'd be maintaining.</Text>
        </View>
      )}

      <SaveBtn saved={saved} disabled={contradicts} onPress={save} />
    </ScrollView>
  );
}

/* ================= UNITS & HEIGHT ================= */
/* Height only. The kg/lbs switch used to live here too, but weight units are
   already chosen on the weight-calibration screen in Stats, and a bare unit
   toggle with no weight beside it read as a leftover. */
export function UnitsScreen({ onBack }: { onBack: () => void }) {
  const { T, profile, updateProfile } = useApp();
  const s = styles(T);

  const [hUnit, setHUnit] = useState(profile.heightUnit);
  const [cm, setCm] = useState(String(profile.heightCm || 175));
  const [saved, setSaved] = useState(false);

  const cmNum = parseFloat(cm) || 0;
  const ft = Math.floor(cmNum / 30.48);
  const inch = Math.round((cmNum / 2.54) % 12);
  const valid = cmNum >= 90 && cmNum <= 250;

  const setFromImperial = (f: number, i: number) => {
    setCm(String(Math.round((f * 12 + i) * 2.54)));
  };

  const save = () => {
    H.success();
    setSaved(true);
    updateProfile({ heightUnit: hUnit, heightCm: Math.round(cmNum) });
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackRow title="Units & height" onBack={onBack} />
      <Text style={s.note}>
        Your height feeds the calorie formula — it's part of working out what your body burns.
      </Text>

      <View style={s.card}>
        <View style={s.unitRow}>
          <View style={s.unitIcon}>
            <Ruler size={16} color={T.green} />
          </View>
          <Text style={s.unitLabel}>Show height in</Text>
          <View style={s.unitToggle}>
            {(["cm", "ft"] as const).map((o) => {
              const on = o === hUnit;
              return (
                <Pressable
                  key={o}
                  onPress={() => { H.tick(); setHUnit(o); }}
                  style={[s.unitBtn, on && { backgroundColor: T.green }]}
                >
                  <Text style={[s.unitText, on && { color: T.ink }]}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={[s.fieldLabel, { marginTop: 22 }]}>Your height</Text>

      {hUnit === "cm" ? (
        <View style={s.heightRow}>
          <TextInput
            value={cm}
            onChangeText={(t) => setCm(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={3}
            style={s.heightInput}
          />
          <Text style={s.heightUnit}>cm</Text>
        </View>
      ) : (
        <View style={s.heightRow}>
          <TextInput
            value={String(ft)}
            onChangeText={(t) => setFromImperial(parseInt(t.replace(/[^0-9]/g, "")) || 0, inch)}
            keyboardType="number-pad"
            maxLength={1}
            style={[s.heightInput, { minWidth: 66 }]}
          />
          <Text style={s.heightUnit}>ft</Text>
          <TextInput
            value={String(inch)}
            onChangeText={(t) => setFromImperial(ft, parseInt(t.replace(/[^0-9]/g, "")) || 0)}
            keyboardType="number-pad"
            maxLength={2}
            style={[s.heightInput, { minWidth: 66, marginLeft: 14 }]}
          />
          <Text style={s.heightUnit}>in</Text>
        </View>
      )}

      <Text style={s.hint}>
        {hUnit === "cm"
          ? `That's ${ft}'${inch}" in feet and inches.`
          : `That's ${Math.round(cmNum)} cm.`}
      </Text>

      {!valid && <Text style={s.mismatch}>Enter a height between 90 and 250 cm.</Text>}

      <SaveBtn saved={saved} disabled={!valid} onPress={save} />

      <Text style={s.foot}>
        Changing your height rebuilds nothing on its own — open Goal to recalculate your target.
      </Text>
    </ScrollView>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    page: { padding: 16, paddingTop: 56, paddingBottom: 40 },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: T.bg },
    buildingText: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    note: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5, marginBottom: 4 },
    foot: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 14, lineHeight: 16 },

    qCount: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase", marginBottom: 6 },
    question: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, marginBottom: 8, lineHeight: 26 },

    choice: { flexDirection: "row", alignItems: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16 },
    choiceLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    choiceSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    card: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 20, marginTop: 12 },

    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    stepBtn: { width: 46, height: 46, borderRadius: 15, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    stepValue: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    stepNum: { fontSize: 36, color: T.text, fontFamily: FONTS.heading },
    stepUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
    recommendNote: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 12 },

    burnedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
    burnedSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    bigRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
    bigNum: { fontSize: 44, color: T.text, fontFamily: FONTS.heading },
    bigUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
    diffRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    diffText: { fontSize: 12.5, fontFamily: FONTS.headingMed },
    doneNote: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5, marginTop: 16, textAlign: "center" },

    primary: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
    secondary: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    secondaryText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },

    currentChip: { alignSelf: "flex-start", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7 },
    currentChipText: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed },

    infoCard: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 13, padding: 13, marginTop: 14 },
    infoText: { flex: 1, fontSize: 12.5, color: T.text, fontFamily: FONTS.body, lineHeight: 18 },
    warnCard: { backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", borderRadius: 13, padding: 13, marginTop: 14 },
    warnText: { fontSize: 12.5, color: "#FBBF24", fontFamily: FONTS.body, lineHeight: 18 },

    unitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    unitIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    unitLabel: { flex: 1, fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    unitToggle: { flexDirection: "row", gap: 2, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, padding: 3 },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    unitText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },

    fieldLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase", marginBottom: 8, marginLeft: 2 },
    heightRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
    heightInput: { fontSize: 44, color: T.text, fontFamily: FONTS.heading, minWidth: 120, padding: 0, borderBottomWidth: 2, borderBottomColor: T.greenBorder, textAlign: "center" },
    heightUnit: { fontSize: 18, color: T.sub, fontFamily: FONTS.body, marginLeft: 10 },
    hint: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, marginTop: 12, marginLeft: 2 },
    mismatch: { fontSize: 11.5, color: T.red, fontFamily: FONTS.body, marginTop: 8, marginLeft: 2 },
  });