// app/(tabs)/stats.tsx
// Stats is one tab holding four views — main, steps, calories, weight — swapped
// by a single `view` state rather than routing, so the tab bar stays put.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Activity, ArrowDown, ChevronLeft, Crown, Footprints, Lock, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import Icon, { IconName } from "../../components/Icon";
import { IsoMGlow } from "../../components/IsoM";
import PageHeader from "../../components/PageHeader";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
// every buzz goes through here so Profile → Haptics actually governs them
import * as H from "../../constants/haptics";
import { FONTS, tierForStreak } from "../../constants/theme";

type Range = "Week" | "Month" | "Year";
type View_ = null | "steps" | "calories" | "weight";
const RANGES: Range[] = ["Week", "Month", "Year"];

const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** the flame animation for a tier — a dedicated file per tier reads far better
    than one generic flame tinted five ways */
const FLAME_FOR_TIER: Record<string, IconName> = {
  Spark: "flameSpark",
  Warming: "flameWarming",
  Hot: "flameHot",
  "Red-hot": "flameRedhot",
  Ultimate: "flameUltimate",
};

/* A month is 28–31 days, so it actually touches 4 weeks plus a few days. We
   show the LAST FOUR WEEKS everywhere — a clean window that means the same
   thing in every month, rather than a chart that changes shape month to month. */
const WEEKS_IN_MONTH = 4;
const DAYS_IN_MONTH = 30.4;   // average, for converting a monthly total back to a daily figure

/* Year runs the CALENDAR year, Jan → Dec. Months after today have no data yet
   and render as empty columns — honest, and it's what a "Year" toggle implies. */
const THIS_MONTH = new Date().getMonth();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** compact step counts — monthly totals run to six figures, and "251.4k"
    doesn't fit under a 12px bar, so drop the decimal once it's that large */
const kfmt = (n: number) => {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

/** the full span of a week N weeks back — "Jul 13–19", or "Jul 27 – Aug 2"
    when it crosses a month. A bare start date reads as a single day, which is
    the wrong idea when the bar is a whole week's average. */
function weekSpanLabel(weeksAgo: number) {
  const start = new Date();
  start.setDate(start.getDate() - weeksAgo * 7 - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return start.getMonth() === end.getMonth()
    ? `${MSHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
    : `${MSHORT[start.getMonth()]} ${start.getDate()} – ${MSHORT[end.getMonth()]} ${end.getDate()}`;
}

/* ---------- stand-in data ----------
   Replaced by real logs + HealthKit once the backend lands. */

const STEP_BASE = 8400;
const STEP_WEEK = [0.88, 1.09, 0.74, 1.24, 0.99, 1.44, 0.61];
const STEP_MONTH = [0.98, 1.08, 0.91, 1.22];
const STEP_YEAR = [0.81, 0.86, 0.94, 1.00, 1.08, 1.05, 1.12, 1.02, 0.96, 0.89, 0.92, 1.03];

/* Calories as FRACTIONS OF THE GOAL — the goal varies per user, so absolute
   values would render all-green for one person and all-red for another. */
const WEEK_RATIO = [0.76, 0.93, 0.74, 1.23, 0.82, 1.09, 0.79];

/* 14 weeks of daily history, oldest first */
const HISTORY_RATIOS: number[][] = [
  [0.88, 1.02, 0.94, 1.31, 0.90, 1.18, 0.86],
  [0.91, 0.97, 1.22, 0.88, 1.04, 1.27, 0.93],
  [0.84, 1.09, 0.90, 0.96, 1.15, 1.02, 0.89],
  [0.80, 0.95, 1.06, 0.92, 1.21, 0.88, 0.97],
  [0.86, 0.91, 0.99, 1.14, 0.87, 1.09, 0.92],
  [0.79, 1.03, 0.88, 0.95, 1.08, 0.91, 0.85],
  [0.83, 0.90, 1.11, 0.86, 0.98, 1.19, 0.88],
  [0.77, 0.94, 0.86, 1.05, 0.91, 1.02, 0.83],
  [0.81, 0.88, 0.95, 0.90, 1.12, 0.87, 0.91],
  [0.75, 0.92, 0.84, 0.98, 0.89, 1.06, 0.80],
  [0.78, 0.86, 0.93, 0.85, 1.01, 0.90, 0.82],
  [0.74, 0.89, 0.81, 0.94, 0.86, 0.99, 0.79],
  [0.76, 0.84, 0.88, 0.82, 0.95, 0.87, 0.81],
  WEEK_RATIO, // this week
];

const YEAR_RATIOS = [1.14, 1.09, 1.05, 1.01, 0.98, 1.03, 0.96, 0.93, 0.97, 0.91, 0.88, 0.90];

const PROTEIN_RATIO: Record<Range, number> = { Week: 0.80, Month: 0.76, Year: 0.72 };
const RANGE_WORD: Record<Range, string> = { Week: "week", Month: "month", Year: "year" };

/* STEPS zoom out by TOTAL, not by average. Calories can't: a month's calorie
   total against a daily goal is meaningless, so those stay average days. */
function stepData(range: Range) {
  if (range === "Week") {
    const bars = STEP_WEEK.map((r, i) => ({
      label: DAY_LABELS[i],
      short: DAY_LABELS[i][0],
      v: Math.round((STEP_BASE * r) / 10) * 10,
    }));
    return { bars, perDay: Math.round(avg(bars.map((b) => b.v))), unit: "avg / day" };
  }

  if (range === "Month") {
    const bars = STEP_MONTH.map((r, i) => ({
      label: `Week ${i + 1}`,
      short: `Wk ${i + 1}`,
      v: Math.round((STEP_BASE * r * 7) / 100) * 100,
    }));
    const total = bars.reduce((a, b) => a + b.v, 0);
    return { bars, perDay: Math.round(total / (WEEKS_IN_MONTH * 7)), unit: "this month" };
  }

  const bars = STEP_YEAR.slice(0, THIS_MONTH + 1).map((r, i) => ({
    label: MSHORT[i],
    short: MSHORT[i][0],
    v: Math.round((STEP_BASE * r * DAYS_IN_MONTH) / 100) * 100,
  }));
  const total = bars.reduce((a, b) => a + b.v, 0);
  return { bars, perDay: Math.round(total / ((THIS_MONTH + 1) * DAYS_IN_MONTH)), unit: "this year" };
}

const STEP_DETAIL_CAPTION: Record<Range, string> = {
  Week: "Each day vs your average day",
  Month: "Each week vs your average week",
  Year: "Each month vs your average month",
};

const STEP_SUMMARY_LABEL: Record<Range, string> = {
  Week: "Average / day",
  Month: "Average / week",
  Year: "Average / month",
};

function yearMonths() {
  return MSHORT.map((label, i) => ({
    label,
    ratio: i <= THIS_MONTH ? YEAR_RATIOS[i] : null,
  }));
}

function calBars(range: Range): { label: string; ratio: number | null }[] {
  if (range === "Week") {
    return WEEK_RATIO.map((ratio, i) => ({ label: DAY_LABELS[i], ratio }));
  }
  if (range === "Month") {
    return HISTORY_RATIOS.slice(-WEEKS_IN_MONTH).map((week, i, arr) => ({
      label: weekSpanLabel(arr.length - 1 - i),
      ratio: avg(week),
    }));
  }
  return yearMonths().map((m) => ({ label: m.label, ratio: m.ratio }));
}

const CAL_CAPTION: Record<Range, string> = {
  Week: "Each day against your goal",
  Month: "Each week's average day",
  Year: "Each month's average day",
};

const BURNED = 2140;
const ACTIVE_MIN = 52;
const AVG_BPM = 68;
const DAYS_LOGGED = 18;
const WEIGHT_CHANGE = -2.1;

/* ---------- the ruler picker ---------- */
const TICK_PX = 12;

function RulerPicker({
  unit, value, setValue, recenter, T,
}: {
  unit: "kg" | "lbs";
  value: number;
  setValue: (v: number) => void;
  recenter: number;
  T: any;
}) {
  const ref = useRef<ScrollView>(null);
  const lastIdx = useRef<number | null>(null);
  const cfg = unit === "kg" ? { min: 30, max: 200, step: 0.1, big: 50 } : { min: 60, max: 440, step: 0.2, big: 50 };
  const ticks = Math.round((cfg.max - cfg.min) / cfg.step);
  const s = rulerStyles(T);

  useEffect(() => {
    const x = Math.round((value - cfg.min) / cfg.step) * TICK_PX;
    lastIdx.current = Math.round((value - cfg.min) / cfg.step);
    const t = setTimeout(() => ref.current?.scrollTo({ x, animated: false }), 40);
    return () => clearTimeout(t);
  }, [unit, recenter]);

  return (
    <View style={s.wrap}>
      <View style={s.needle} pointerEvents="none" />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TICK_PX}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: "50%" }}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / TICK_PX);
          if (idx === lastIdx.current) return;
          lastIdx.current = idx;
          const v = +(cfg.min + idx * cfg.step).toFixed(1);
          if (v >= cfg.min && v <= cfg.max) {
            H.tick();
            setValue(v);
          }
        }}
      >
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const big = i % cfg.big === 0;
          return (
            <View key={i} style={s.tickCol}>
              <View style={{ width: big ? 2 : 1, height: big ? 40 : 24, backgroundColor: big ? T.micro : T.border, borderRadius: 2 }} />
              {big && <Text style={s.tickLabel}>{Math.round(cfg.min + i * cfg.step)}</Text>}
            </View>
          );
        })}
      </ScrollView>

      <LinearGradient colors={[T.card, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fade, { left: 0 }]} pointerEvents="none" />
      <LinearGradient colors={["transparent", T.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fade, { right: 0 }]} pointerEvents="none" />
    </View>
  );
}

export default function Stats() {
  const router = useRouter();
  const { T, freeLocked, plan, profile, updateProfile, openPaywall, tabResetKey, streakDays, settings } = useApp();
  const [range, setRange] = useState<Range>("Week");
  const [view, setView] = useState<View_>(null);

  const s = styles(T);
  const rangeWord = RANGE_WORD[range];

  const tier = tierForStreak(streakDays);
  const flameAnim = FLAME_FOR_TIER[tier.name] || "flameSpark";

  /* tapping the Stats tab while already on it drops back to the main view */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setView(null);
  }, [tabResetKey]);

  const { bars: steps, perDay: stepsPerDay, unit: stepUnit } = useMemo(() => stepData(range), [range]);
  const maxStep = useMemo(() => Math.max(...steps.map((b) => b.v)), [steps]);
  const avgBar = useMemo(() => Math.round(avg(steps.map((b) => b.v))), [steps]);
  const totalStep = useMemo(() => steps.reduce((a, b) => a + b.v, 0), [steps]);
  const headline = range === "Week" ? stepsPerDay : totalStep;

  const goal = plan.calories;

  const bars = useMemo(() => calBars(range), [range]);
  const calValues = useMemo(
    () => bars.map((b) => (b.ratio == null ? null : Math.round((goal * b.ratio) / 10) * 10)),
    [bars, goal]
  );
  const logged = useMemo(() => calValues.filter((v): v is number => v != null), [calValues]);
  const periodAvg = useMemo(() => Math.round(avg(logged) / 10) * 10, [logged]);
  const diff = goal - periodAvg;

  const calLabelW = range === "Month" ? 78 : 40;
  const stepBarW = range === "Year" ? 12 : range === "Month" ? 24 : 17;

  const unit = profile.weightUnit;
  const shownChange = unit === "kg" ? WEIGHT_CHANGE : WEIGHT_CHANGE * 2.20462;

  const typicalCal = periodAvg;
  const typicalSteps = stepsPerDay;
  const typicalProtein = Math.round(plan.protein * PROTEIN_RATIO[range]);

  const Micro = ({ children }: { children: React.ReactNode }) => <Text style={s.micro}>{children}</Text>;

  const CalBar = ({ label, v, labelW }: { label: string; v: number | null; labelW: number }) => {
    if (v == null) {
      return (
        <View style={s.calBarRow}>
          <Text style={[s.calBarLabel, { width: labelW, color: T.micro }]} numberOfLines={1}>{label}</Text>
          <View style={s.calBarTrack} />
        </View>
      );
    }
    const over = v - goal;
    const color = over <= 0 ? T.green : over <= goal * 0.17 ? T.orange : T.red;
    const pct = Math.max(30, Math.min(100, (v / (goal * 1.28)) * 100));
    return (
      <View style={s.calBarRow}>
        <Text style={[s.calBarLabel, { width: labelW }]} numberOfLines={1}>{label}</Text>
        <View style={s.calBarTrack}>
          <View style={[s.calBarFill, { width: `${pct}%`, backgroundColor: color }]}>
            <Text style={s.calBarInside}>{v.toLocaleString()} / {goal.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    );
  };

  const Legend = ({ color, label }: { color: string; label: string }) => (
    <View style={s.legendItem}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );

  const Stat = ({ icon: Icn, v, l }: { icon?: any; v: string; l: string }) => (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={s.statTop}>
        {Icn && <Icn size={13} color={T.green} />}
        <Text style={s.statNum}>{v}</Text>
      </View>
      <Text style={s.micro}>{l}</Text>
    </View>
  );

  const BackHead = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <Pressable onPress={onBack} style={s.backRow} hitSlop={10}>
      <ChevronLeft size={24} color={T.text} />
      <Text style={s.backTitle}>{title}</Text>
    </Pressable>
  );

  /* ================= STEPS DETAIL ================= */
  if (view === "steps") {
    const refPct = Math.min(100, (avgBar / maxStep) * 100);

    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <BackHead title={`Steps · this ${rangeWord}`} onBack={() => setView(null)} />

          <View style={s.summaryRow}>
            <View style={s.summaryCard}>
              <Micro>{STEP_SUMMARY_LABEL[range]}</Micro>
              <Text style={s.summaryNum}>{avgBar.toLocaleString()}</Text>
            </View>
            <View style={s.summaryCard}>
              <Micro>Total this {rangeWord}</Micro>
              <Text style={s.summaryNum}>{totalStep.toLocaleString()}</Text>
            </View>
          </View>

          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 16 }}>
              <View style={[s.rowBetween, { marginBottom: 14 }]}>
                <Text style={s.detailCaption}>{STEP_DETAIL_CAPTION[range]}</Text>
                <Text style={s.detailAvg}>avg {avgBar.toLocaleString()}</Text>
              </View>

              {steps.map((b, i) => {
                const above = b.v >= avgBar;
                const color = above ? T.green : T.orange;
                const pct = Math.max(34, Math.min(100, (b.v / maxStep) * 100));
                return (
                  <View key={i} style={s.stepBarRow}>
                    <Text style={s.stepBarLabel} numberOfLines={1}>{b.label}</Text>
                    <View style={s.stepBarTrack}>
                      <View style={[s.stepBarFill, { width: `${pct}%`, backgroundColor: color }]}>
                        <Text style={s.stepBarInside}>{b.v.toLocaleString()} / {avgBar.toLocaleString()}</Text>
                      </View>
                      <View style={[s.refLine, { left: `${refPct}%` }]} />
                    </View>
                  </View>
                );
              })}

              <View style={s.legendRow}>
                <Legend color={T.green} label="Above avg" />
                <Legend color={T.orange} label="Below avg" />
              </View>
            </View>
          </TravelBorder>

          <Text style={s.detailFoot}>
            {range === "Week"
              ? "Steps come from your connected watch · MOTION doesn't estimate them"
              : `That's about ${stepsPerDay.toLocaleString()} steps a day across the ${rangeWord}.`}
          </Text>
        </ScrollView>
      </View>
    );
  }

  /* ================= CALORIES DETAIL ================= */
  if (view === "calories") {
    return (
      <CaloriesView
        T={T}
        s={s}
        goal={goal}
        freeLocked={freeLocked}
        onBack={() => setView(null)}
        onGoPro={() => openPaywall("subscribe")}
      />
    );
  }

  /* ================= WEIGHT DETAIL ================= */
  if (view === "weight") {
    return (
      <WeightView
        T={T}
        s={s}
        startUnit={unit}
        estimate={profile.startWeight}
        onBack={() => setView(null)}
        onSave={(v, u) => {
          updateProfile({ startWeight: v, weightUnit: u });
          setView(null);
        }}
      />
    );
  }

  /* ================= MAIN ================= */
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <PageHeader title="Stats" />

        <View style={s.rangeRow}>
          {RANGES.map((r) => (
            <Pressable key={r} onPress={() => setRange(r)} style={[s.rangeBtn, range === r && { backgroundColor: T.green }]}>
              <Text style={[s.rangeText, range === r && { color: T.ink }]}>{r}</Text>
            </Pressable>
          ))}
        </View>

        {/* WIDGET 1 — STEPS */}
        <Tap onPress={() => setView("steps")}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
            <View style={{ padding: 18 }}>
              <View style={s.rowBetween}>
                <View style={s.rowGap}>
                  {/* no footprint animation in the set — stays Lucide */}
                  <Footprints size={15} color={T.green} />
                  <Micro>Steps · this {rangeWord}</Micro>
                </View>

                {/* the source chip — the watch pulses, since it's what's
                    feeding the numbers. Dimmed when sync is switched off. */}
                <View style={[s.sourceChip, !settings.watch && { opacity: 0.45 }]}>
                  <Icon name="watchHealth" size={17} mode="loop" />
                  <Text style={s.sourceText}>{settings.watch ? "Garmin" : "Not syncing"}</Text>
                </View>
              </View>

              <View style={s.bigRow}>
                <Text style={s.bigNum}>{headline.toLocaleString()}</Text>
                <Text style={s.bigUnit}>{stepUnit}</Text>
              </View>

              {range !== "Week" && (
                <Text style={s.stepSubNote}>about {stepsPerDay.toLocaleString()} a day</Text>
              )}

              <View style={s.chart}>
                {steps.map((b, i) => (
                  <View key={i} style={s.barCol}>
                    <Text style={s.barVal}>{kfmt(b.v)}</Text>
                    <View style={s.barTrack}>
                      <LinearGradient
                        colors={["#22C55E", "#15803D"]}
                        style={[s.bar, { width: stepBarW, height: Math.max(4, (b.v / maxStep) * 68) }]}
                      />
                    </View>
                    <Text style={s.barLabel}>{b.short}</Text>
                  </View>
                ))}
              </View>

              <View style={s.statsRow}>
                {/* burned uses the tier flame — it's the same "energy" idea */}
                <View style={{ alignItems: "center", flex: 1 }}>
                  <View style={s.statTop}>
                    <Icon name={freeLocked ? "flameSpark" : flameAnim} size={15} mode="loop" />
                    <Text style={s.statNum}>{BURNED.toLocaleString()}</Text>
                  </View>
                  <Text style={s.micro}>Burned</Text>
                </View>
                <Stat icon={Activity} v={String(ACTIVE_MIN)} l="Active min" />
                <Stat v={String(AVG_BPM)} l="Avg BPM" />
              </View>

              <View style={s.cardFoot}>
                <Text style={s.cardFootText}>Tap for the daily breakdown</Text>
                <TrendingUp size={12} color={T.green} />
              </View>
            </View>
          </TravelBorder>
        </Tap>

        {/* WIDGET 2 — CALORIES VS GOAL */}
        <Tap onPress={() => setView("calories")} style={{ marginTop: 12 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 16 }}>
              <View style={[s.rowBetween, { marginBottom: 4 }]}>
                <View style={s.rowGap}>
                  <Icon name="targetBullseye" size={18} mode="loop" />
                  <Micro>Calories vs goal</Micro>
                </View>
                <View style={s.rowGapTight}>
                  {diff >= 0 ? <TrendingDown size={12} color={T.green} /> : <TrendingUp size={12} color={T.red} />}
                  <Text style={[s.trendText, { color: diff >= 0 ? T.green : T.red }]}>
                    {Math.abs(diff)} {diff >= 0 ? "under" : "over"} avg
                  </Text>
                </View>
              </View>

              <Text style={s.calCaption}>{CAL_CAPTION[range]}</Text>

              {calValues.map((v, i) => (
                <CalBar key={i} label={bars[i].label} v={v} labelW={calLabelW} />
              ))}

              <View style={s.legendRow}>
                <Legend color={T.green} label="Under goal" />
                <Legend color={T.orange} label="A bit over" />
                <Legend color={T.red} label="Way over" />
                <Text style={s.historyLink}>Weekly history →</Text>
              </View>
            </View>
          </TravelBorder>
        </Tap>

        {/* WIDGETS 3 + 4 — both locked on free */}
        <View style={s.pairRow}>
          <View style={{ flex: 1 }}>
            <BlurLock label="Consistency" locked={freeLocked} radius={16} compact>
              <Tap onPress={() => router.push("/(tabs)/calendar")}>
                <TravelBorder color={T.orange} cardBg={T.card} borderColor={T.border} radius={16}>
                  <View style={s.smallCard}>
                    <View style={s.rowBetween}>
                      <Micro>Consistency</Micro>
                      {/* the calendar, since this card is the way into it */}
                      <Icon name="calendar" size={17} mode="loop" />
                    </View>
                    <View style={s.smallNumRow}>
                      <Text style={s.smallNum}>{DAYS_LOGGED}</Text>
                      {/* and the tier flame, matching Home's streak chip */}
                      <View style={{ marginLeft: "auto" }}>
                        <Icon name={freeLocked ? "flameSpark" : flameAnim} size={18} mode="loop" />
                      </View>
                    </View>
                    <Text style={[s.smallNote, { color: T.orange }]}>days logged · view calendar</Text>
                  </View>
                </TravelBorder>
              </Tap>
            </BlurLock>
          </View>

          <View style={{ flex: 1 }}>
            <BlurLock label="Weight" locked={freeLocked} radius={16} compact>
              <Tap onPress={() => setView("weight")}>
                <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
                  <View style={s.smallCard}>
                    <View style={s.rowBetween}>
                      <Micro>Weight</Micro>
                      <View style={s.editTag}>
                        <Text style={s.editTagText}>TAP TO EDIT</Text>
                      </View>
                    </View>
                    <View style={s.smallNumRow}>
                      <Text style={s.smallNum}>{shownChange.toFixed(1)}</Text>
                      <Text style={s.smallUnit}>{unit}</Text>
                      <View style={{ marginLeft: "auto" }}>
                        <Icon name="scale" size={18} mode="loop" />
                      </View>
                    </View>
                    <Text style={[s.smallNote, { color: T.green }]}>estimated · on track</Text>
                  </View>
                </TravelBorder>
              </Tap>
            </BlurLock>
          </View>
        </View>

        {/* WIDGET 5 — informational, deliberately not tappable */}
        <View style={{ marginTop: 12 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 16 }}>
              <Micro>Your typical day · this {rangeWord}</Micro>
              <View style={s.typicalRow}>
                {[
                  [typicalCal.toLocaleString(), "cal"],
                  [`${typicalProtein}g`, "protein"],
                  [typicalSteps.toLocaleString(), "steps"],
                ].map(([v, l]) => (
                  <View key={l} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.typicalNum}>{v}</Text>
                    <Text style={s.typicalLabel}>{l.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.typicalFoot}>
                Averaged by MOTION from your recent logs · updates on its own
              </Text>
            </View>
          </TravelBorder>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- one week card ---------- */
function WeekCard({
  T, s, wk, goal, animate, last,
}: {
  T: any;
  s: any;
  wk: { key: string; span: string; current: boolean; vals: number[] };
  goal: number;
  animate: boolean;
  last: boolean;
}) {
  const a = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(a, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] });

  const weekAvg = Math.round(avg(wk.vals));
  const under = wk.vals.filter((v) => v <= goal).length;

  return (
    <Animated.View style={{ marginBottom: last ? 0 : 14, opacity: a, transform: [{ translateY }] }}>
      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 16 }}>
          <View style={[s.rowBetween, { marginBottom: 12 }]}>
            <View style={s.rowGap}>
              <Text style={s.histWeek}>{wk.span}</Text>
              {wk.current && (
                <View style={s.thisWeekTag}>
                  <Text style={s.thisWeekText}>This week</Text>
                </View>
              )}
            </View>
            <Text style={s.histAvg}>avg {weekAvg.toLocaleString()} · {under}/7 under</Text>
          </View>

          {wk.vals.map((v, i) => {
            const over = v - goal;
            const color = over <= 0 ? T.green : over <= goal * 0.17 ? T.orange : T.red;
            const pct = Math.max(30, Math.min(100, (v / (goal * 1.28)) * 100));
            return (
              <View key={i} style={s.calBarRow}>
                <Text style={[s.calBarLabel, { width: 40 }]}>{DAY_LABELS[i]}</Text>
                <View style={s.calBarTrack}>
                  <View style={[s.calBarFill, { width: `${pct}%`, backgroundColor: color }]}>
                    <Text style={s.calBarInside}>{v.toLocaleString()} / {goal.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </TravelBorder>
    </Animated.View>
  );
}

/* ---------- weekly history ----------
   INVERTED scroll: newest week at the bottom, older above. Loading is
   DELIBERATE — reaching the top shows a hint, and the user pulls down. */
function CaloriesView({
  T, s, goal, freeLocked, onBack, onGoPro,
}: {
  T: any;
  s: any;
  goal: number;
  freeLocked: boolean;
  onBack: () => void;
  onGoPro: () => void;
}) {
  const BATCH = 4;
  const FREE_CAP = 2;
  const HOLD_MS = 1200;
  const STEP_MS = 1000;

  const total = HISTORY_RATIOS.length;
  const cap = freeLocked ? Math.min(FREE_CAP, total) : total;
  const initialCount = Math.min(BATCH, cap);

  const ref = useRef<ScrollView>(null);
  const contentH = useRef(0);
  const pendingH = useRef<number | null>(null);
  const offsetY = useRef(0);
  const didInit = useRef(false);
  const shownRef = useRef(initialCount);
  const initialKeys = useRef<Set<string>>(new Set());

  const [shown, setShown] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [atTop, setAtTop] = useState(false);
  const [wall, setWall] = useState(false);

  const hasMore = shown < total;
  const atFreeWall = freeLocked && shown >= cap && cap < total;

  useEffect(() => { shownRef.current = shown; }, [shown]);

  const weeks = useMemo(() => {
    const start = Math.max(0, total - shown);
    return HISTORY_RATIOS.slice(start).map((ratios, i) => {
      const idxFromEnd = HISTORY_RATIOS.length - start - 1 - i;
      return {
        key: `w${start + i}`,
        span: weekSpanLabel(idxFromEnd),
        current: idxFromEnd === 0,
        vals: ratios.map((r) => Math.round((goal * r) / 10) * 10),
      };
    });
  }, [shown, goal, total]);

  if (initialKeys.current.size === 0 && weeks.length) {
    weeks.forEach((w) => initialKeys.current.add(w.key));
  }

  const onContentSize = useCallback((_: number, h: number) => {
    contentH.current = h;

    if (!didInit.current) {
      didInit.current = true;
      requestAnimationFrame(() => ref.current?.scrollTo({ y: h, animated: false }));
      return;
    }

    if (pendingH.current != null) {
      const grew = h - pendingH.current;
      pendingH.current = null;
      if (grew > 0) {
        requestAnimationFrame(() =>
          ref.current?.scrollTo({ y: offsetY.current + grew, animated: false })
        );
      }
    }
  }, []);

  const onScroll = useCallback((e: any) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    const top = offsetY.current < 60;
    setAtTop((cur) => (cur === top ? cur : top));
  }, []);

  const onRefresh = useCallback(async () => {
    if (loading || !hasMore) return;

    if (atFreeWall) {
      H.warn();
      setWall(true);
      return;
    }

    H.tap();
    setLoading(true);
    await sleep(HOLD_MS);

    for (let i = 0; i < BATCH; i++) {
      if (shownRef.current >= cap) break;
      pendingH.current = contentH.current;
      setShown((c) => Math.min(cap, c + 1));
      await sleep(STEP_MS);
    }

    setLoading(false);
  }, [loading, hasMore, atFreeWall, cap]);

  return (
    <View style={s.screen}>
      <View style={s.histHead}>
        <Pressable onPress={onBack} style={s.backRow} hitSlop={10}>
          <ChevronLeft size={24} color={T.text} />
          <Text style={s.backTitle}>Calories · weekly history</Text>
        </Pressable>
        <View style={s.histLegend}>
          <View style={s.legendItem}>
            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: T.green }} />
            <Text style={s.legendText}>Under goal</Text>
          </View>
          <View style={s.legendItem}>
            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: T.orange }} />
            <Text style={s.legendText}>A bit over</Text>
          </View>
          <View style={s.legendItem}>
            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: T.red }} />
            <Text style={s.legendText}>Way over</Text>
          </View>
          <Text style={s.histGoal}>goal {goal.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={onContentSize}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        }
      >
        {loading ? (
          <View style={s.histLoading}>
            <IsoMGlow size={56} />
            <Text style={s.histLoadingText}>Loading earlier weeks…</Text>
          </View>
        ) : !hasMore ? (
          <Text style={s.histEdge}>· your very first week ·</Text>
        ) : atFreeWall ? (
          <Tap onPress={() => setWall(true)} style={{ marginBottom: 14 }}>
            <View style={s.histLockBar}>
              <Lock size={13} color={T.gold} />
              <Text style={s.histLockText}>See earlier weeks with Pro</Text>
            </View>
          </Tap>
        ) : atTop ? (
          <View style={s.pullHint}>
            <ArrowDown size={14} color={T.green} />
            <Text style={s.pullHintText}>Pull down to load earlier weeks</Text>
          </View>
        ) : (
          <Text style={s.histEdge}>↑ earlier weeks above</Text>
        )}

        {weeks.map((wk, wi) => (
          <WeekCard
            key={wk.key}
            T={T}
            s={s}
            wk={wk}
            goal={goal}
            animate={!initialKeys.current.has(wk.key)}
            last={wi === weeks.length - 1}
          />
        ))}
      </ScrollView>

      {wall && (
        <View style={s.wallWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setWall(false)} />
          <View style={s.wallCard}>
            <View style={s.wallIcon}>
              <Crown size={24} color={T.gold} />
            </View>
            <Text style={s.wallTitle}>Your full history is waiting</Text>
            <Text style={s.wallBody}>
              Free shows your last two weeks. Pro opens every week you've ever logged, so you can see
              how far you've actually come.
            </Text>
            <Tap onPress={onGoPro} style={{ width: "100%", marginTop: 16 }}>
              <View style={s.wallCta}>
                <Text style={s.wallCtaText}>Unlock full history</Text>
              </View>
            </Tap>
            <Pressable onPress={() => setWall(false)} style={{ marginTop: 12 }} hitSlop={10}>
              <Text style={s.wallDismiss}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/* ---------- weight calibration ---------- */
function WeightView({
  T, s, startUnit, estimate, onBack, onSave,
}: {
  T: any;
  s: any;
  startUnit: "kg" | "lbs";
  estimate: number;
  onBack: () => void;
  onSave: (v: number, u: "kg" | "lbs") => void;
}) {
  const [unit, setUnit] = useState<"kg" | "lbs">(startUnit);
  const [val, setVal] = useState(estimate);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(String(estimate));
  const [rc, setRc] = useState(0);

  const lim = unit === "kg" ? [30, 200] : [60, 440];
  const est = unit === startUnit ? estimate : startUnit === "kg" ? estimate * 2.20462 : estimate / 2.20462;
  const secondary = unit === "kg" ? `${(val * 2.20462).toFixed(1)} lbs` : `${(val / 2.20462).toFixed(1)} kg`;

  const switchUnit = (u: "kg" | "lbs") => {
    if (u === unit) return;
    setVal(+(u === "kg" ? val / 2.20462 : val * 2.20462).toFixed(1));
    setUnit(u);
    setRc((x) => x + 1);
  };

  const commit = () => {
    const n = parseFloat(draft);
    const v = Math.min(lim[1], Math.max(lim[0], isNaN(n) ? val : +n.toFixed(1)));
    setVal(v);
    setTyping(false);
    setRc((x) => x + 1);
  };

  const save = () => {
    H.success();
    onSave(+val.toFixed(1), unit);
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <Pressable onPress={onBack} style={s.backRow} hitSlop={10}>
          <ChevronLeft size={24} color={T.text} />
          <Text style={s.backTitle}>Log your real weight</Text>
        </Pressable>

        {/* the scale, large, as the screen's mark */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <Icon name="scale" size={54} mode="loop" />
        </View>

        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 16 }}>
            <Text style={s.micro}>WHAT WE ESTIMATED</Text>
            <View style={s.estRow}>
              <Text style={s.estNum}>{est.toFixed(1)}</Text>
              <Text style={s.estUnit}>{unit} (from your plan)</Text>
            </View>
          </View>
        </TravelBorder>

        <Text style={s.weightLead}>
          Scroll to your real number — tracking continues accurately from here.
        </Text>

        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 18, paddingTop: 16 }}>
            <View style={s.rowBetween}>
              <View style={s.rowGap}>
                <Icon name="ruler" size={16} mode="loop" />
                <Text style={s.micro}>CURRENT WEIGHT</Text>
              </View>
              <View style={s.unitToggle}>
                {(["kg", "lbs"] as const).map((u) => (
                  <Pressable key={u} onPress={() => switchUnit(u)} style={[s.unitBtn, unit === u && { backgroundColor: T.green }]}>
                    <Text style={[s.unitText, unit === u && { color: T.ink }]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {typing ? (
              <View style={s.bigWeightRow}>
                <TextInput
                  autoFocus
                  keyboardType="decimal-pad"
                  value={draft}
                  onChangeText={setDraft}
                  onBlur={commit}
                  onSubmitEditing={commit}
                  style={s.weightInput}
                />
                <Text style={s.weightUnitBig}>{unit}</Text>
              </View>
            ) : (
              <Pressable onPress={() => { setDraft(val.toFixed(1)); setTyping(true); }} style={s.bigWeightRow}>
                <Text style={s.weightBig}>{val.toFixed(1)}</Text>
                <Text style={s.weightUnitBig}>{unit}</Text>
              </Pressable>
            )}

            <Text style={s.weightSecondary}>{secondary}</Text>

            <RulerPicker unit={unit} value={val} setValue={setVal} recenter={rc} T={T} />

            <Text style={s.rulerHint}>Scroll left or right — it clicks as you go</Text>
            <Text style={s.rulerAlt}>Or tap the number to type it</Text>
          </View>
        </TravelBorder>

        <Tap onPress={save} style={{ marginTop: 18 }}>
          <View style={s.saveBtn}>
            <Text style={s.saveText}>Save {val.toFixed(1)} {unit}</Text>
          </View>
        </Tap>

        <Text style={s.weightFoot}>
          Your estimate updates from here. MOTION keeps projecting between weigh-ins.
        </Text>
      </ScrollView>
    </View>
  );
}

const rulerStyles = (T: any) =>
  StyleSheet.create({
    wrap: { width: "100%", height: 78, marginTop: 10, position: "relative" },
    needle: {
      position: "absolute", left: "50%", marginLeft: -1.5, top: 2,
      width: 3, height: 50, borderRadius: 3, backgroundColor: T.green, zIndex: 3,
    },
    tickCol: { width: TICK_PX, alignItems: "center" },
    tickLabel: { fontSize: 9, color: T.micro, fontFamily: FONTS.heading, marginTop: 4 },
    fade: { position: "absolute", top: 0, bottom: 0, width: 50, zIndex: 2 },
  });

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowGap: { flexDirection: "row", alignItems: "center", gap: 7 },
    rowGapTight: { flexDirection: "row", alignItems: "center", gap: 4 },

    rangeRow: { flexDirection: "row", gap: 4, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 4, marginBottom: 16 },
    rangeBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
    rangeText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },

    sourceChip: { flexDirection: "row", alignItems: "center", gap: 5 },
    sourceText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },

    bigRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
    bigNum: { fontSize: 40, color: T.text, fontFamily: FONTS.heading },
    bigUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    stepSubNote: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },

    chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 },
    barCol: { flex: 1, alignItems: "center", gap: 5 },
    barVal: { fontSize: 8, color: T.sub, fontFamily: FONTS.headingMed },
    barTrack: { height: 68, justifyContent: "flex-end" },
    bar: { borderRadius: 6 },
    barLabel: { fontSize: 9, color: T.micro, fontFamily: FONTS.heading },

    statsRow: { flexDirection: "row", marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
    statTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    statNum: { fontSize: 18, color: T.text, fontFamily: FONTS.heading },

    cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 },
    cardFootText: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },

    trendText: { fontSize: 11, fontFamily: FONTS.headingMed },
    calCaption: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginBottom: 12 },

    calBarRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 },
    calBarLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
    calBarTrack: { flex: 1, height: 26, borderRadius: 8, backgroundColor: T.track, overflow: "hidden" },
    calBarFill: { height: "100%", borderRadius: 8, alignItems: "flex-end", justifyContent: "center", paddingRight: 10 },
    calBarInside: { fontSize: 10.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },

    legendRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },
    historyLink: { marginLeft: "auto", fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },

    pairRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    smallCard: { padding: 14, minHeight: 92 },
    smallNumRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    smallNum: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    smallUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    smallNote: { fontSize: 10, fontFamily: FONTS.body, marginTop: 10 },
    editTag: { borderWidth: 1, borderColor: `${T.green}55`, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
    editTagText: { fontSize: 8.5, color: T.green, fontFamily: FONTS.body },

    typicalRow: { flexDirection: "row", marginTop: 12 },
    typicalNum: { fontSize: 18, color: T.text, fontFamily: FONTS.heading },
    typicalLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2, letterSpacing: 0.6 },
    typicalFoot: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 13, textAlign: "center", lineHeight: 13.5 },

    /* detail screens */
    backRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginLeft: -6 },
    backTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, marginLeft: 2 },

    summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    summaryCard: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
    summaryNum: { fontSize: 23, color: T.text, fontFamily: FONTS.heading, marginTop: 6 },

    detailCaption: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, flex: 1 },
    detailAvg: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed },
    detailFoot: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 16, lineHeight: 15 },

    stepBarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    stepBarLabel: { width: 52, fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
    stepBarTrack: { flex: 1, height: 28, borderRadius: 8, backgroundColor: T.track, overflow: "hidden", position: "relative" },
    stepBarFill: { height: "100%", borderRadius: 8, alignItems: "flex-end", justifyContent: "center", paddingRight: 8 },
    stepBarInside: { fontSize: 11, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    refLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: T.text, opacity: 0.5, borderRadius: 2 },

    /* weekly history */
    histHead: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border },
    histLegend: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: -4 },
    histGoal: { marginLeft: "auto", fontSize: 10, color: T.micro, fontFamily: FONTS.body },
    histEdge: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", paddingBottom: 14 },
    histLoading: { alignItems: "center", gap: 6, paddingBottom: 18, paddingTop: 6 },
    histLoadingText: { fontSize: 11, color: T.micro, fontFamily: FONTS.body },
    pullHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 13, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, marginBottom: 14 },
    pullHintText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
    histLockBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}55` },
    histLockText: { fontSize: 12, color: T.gold, fontFamily: FONTS.headingMed },
    histWeek: { fontSize: 14, color: T.text, fontFamily: FONTS.heading },
    histAvg: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
    thisWeekTag: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    thisWeekText: { fontSize: 9, color: T.green, fontFamily: FONTS.headingMed },

    wallWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: "center", justifyContent: "center", padding: 26, backgroundColor: "rgba(10,10,10,0.72)" },
    wallCard: { width: "100%", maxWidth: 320, backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}55`, borderRadius: 20, padding: 22, alignItems: "center" },
    wallIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "rgba(251,191,36,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
    wallTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    wallBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18.5, marginTop: 8 },
    wallCta: { backgroundColor: T.gold, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    wallCtaText: { fontSize: 14, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    wallDismiss: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    /* weight */
    estRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 },
    estNum: { fontSize: 26, color: T.sub, fontFamily: FONTS.heading },
    estUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    weightLead: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, marginVertical: 16, lineHeight: 19 },

    unitToggle: { flexDirection: "row", gap: 2, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, padding: 3 },
    unitBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
    unitText: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed },

    bigWeightRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6, marginTop: 8 },
    weightBig: { fontSize: 44, color: T.text, fontFamily: FONTS.heading },
    weightInput: { width: 130, fontSize: 44, color: T.text, fontFamily: FONTS.heading, textAlign: "center", borderBottomWidth: 2, borderBottomColor: T.green, padding: 0 },
    weightUnitBig: { fontSize: 16, color: T.sub, fontFamily: FONTS.body },
    weightSecondary: { fontSize: 12, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 2 },

    rulerHint: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 4 },
    rulerAlt: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed, textAlign: "center", marginTop: 6 },

    saveBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    saveText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
    weightFoot: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14, lineHeight: 15 },
  });