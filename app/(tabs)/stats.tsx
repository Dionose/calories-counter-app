// app/(tabs)/stats.tsx
// Stats is one tab holding four views — main, steps, calories, weight — swapped
// by a single `view` state rather than routing, so the tab bar stays put.
//
// ONE EXCEPTION TO THAT: a `view=weight` parameter can be handed in from
// outside. Home's expected-weight sheet uses it, so "I've weighed myself"
// lands on the weigh-in screen instead of dropping the user on the Stats
// front page to find it themselves.
//
// EVERYTHING HERE IS REAL:
//   Calories    — summed from logged meals
//   Consistency — counted from logged days
//   Weight      — from weigh-ins
//   Steps       — read from HealthKit / Health Connect, INCLUDING history from
//                 before MOTION was installed. The phone has been counting
//                 since the day it was bought.
//
// MOTION never estimates activity. A guessed step count looks identical to a
// real one, which quietly makes every other number on the screen suspect.
//
// EVERY AXIS LABEL IS SPELLED OUT. No initials, no bare dates, no week
// numbers — if the reader has to decode the chart before they can read it,
// the chart has failed.
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Activity, ArrowDown, ChevronLeft, Crown, Footprints, Lock, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import Icon, { IconName } from "../../components/Icon";
import { IsoMGlow } from "../../components/IsoM";
import PageHeader from "../../components/PageHeader";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import WeighInSheet from "../../components/WeighInSheet";
import WeightChart from "../../components/WeightChart";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";
import { DayActivity, isHealthAvailable, loadActivity, recentHeartRate, requestHealthPermission } from "../../constants/health";
import { loadDayTotals, loggedDayCount, todayLocal } from "../../constants/meals";
import { FONTS, tierForStreak } from "../../constants/theme";
import { actualPacePerWeek, fromKg, loadWeighIns, toKg, WeighIn } from "../../constants/weight";

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

const WEEKS_IN_MONTH = 4;
const THIS_MONTH = new Date().getMonth();
const THIS_YEAR = new Date().getFullYear();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** compact step counts — a year's total runs to seven figures, and "1,284,300"
    doesn't fit under a 12px bar */
const kfmt = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

/** the full span of a week N weeks back — "Jul 13–19", or "Jul 27 – Aug 2"
    when it crosses a month.

    ALWAYS the full span, never just the start date. A bar covering seven days
    labelled "Jul 27" reads as Sunday the 27th — the reader has no way to know
    it's a week unless the label says so. */
function weekSpanLabel(weeksAgo: number) {
  const start = new Date();
  start.setDate(start.getDate() - weeksAgo * 7 - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return start.getMonth() === end.getMonth()
    ? `${MSHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
    : `${MSHORT[start.getMonth()]} ${start.getDate()} – ${MSHORT[end.getMonth()]} ${end.getDate()}`;
}

/** monday-first day index — the charts run Mon–Sun, JS runs Sun–Sat */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** the Monday of the week N weeks back */
function mondayOf(weeksAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7 - mondayIndex(d));
  d.setHours(0, 0, 0, 0);
  return d;
}

const RANGE_WORD: Record<Range, string> = { Week: "week", Month: "month", Year: "year" };

const CAL_CAPTION: Record<Range, string> = {
  Week: "Each day against your goal",
  Month: "Each week's average day",
  Year: "Each month's average day",
};

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

export default function Stats() {
  const router = useRouter();
  const { T, freeLocked, plan, profile, openPaywall, tabResetKey, streakDays, userId } = useApp();
  const [range, setRange] = useState<Range>("Week");

  /* ---------- ARRIVING FROM SOMEWHERE ELSE ----------
     Home's expected-weight sheet sends `?view=weight`. Read on the first
     render so the weight screen is what appears, rather than the Stats front
     page flashing first. */
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View_>(params.view === "weight" ? "weight" : null);

  /* The tab may already be mounted from an earlier visit, in which case the
     useState above never runs again — so react to the parameter arriving too.
     It's CLEARED straight after: without that, every later tap on the Stats
     tab would reopen the weight screen, because the stale parameter is still
     sitting in the route. */
  useEffect(() => {
    if (params.view === "weight") {
      setView("weight");
      router.setParams({ view: undefined });
    }
  }, [params.view]);

  const s = styles(T);
  const rangeWord = RANGE_WORD[range];

  const tier = tierForStreak(streakDays);
  const flameAnim = FLAME_FOR_TIER[tier.name] || "flameSpark";

  /* ---------- MEALS + WEIGHT ---------- */
  const [dayTotals, setDayTotals] = useState<Record<string, number>>({});
  const [daysLogged, setDaysLogged] = useState(0);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);
  const [weighTick, setWeighTick] = useState(0);

  /* ---------- HEALTH ----------
     `available` is whether the device can do this at all — false on a
     simulator or an Android phone without Health Connect. `connected` is
     whether we've actually got data back.

     iOS deliberately never tells you whether READ permission was granted:
     Apple treats the refusal itself as private information. So "connected"
     means "we asked, and data came back" — the only honest test.

     `asked` tracks whether they've tapped Connect at least once, so we can
     tell "hasn't tried yet" apart from "tried and nothing came back". */
  const [available, setAvailable] = useState(false);
  const [activity, setActivity] = useState<DayActivity[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthTick, setHealthTick] = useState(0);
  const [asked, setAsked] = useState(false);

  const connected = activity.length > 0;

  /* still on screen? Guards the state writes below, since a fetch can land
     after the user has moved on. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /** everything this tab draws, in one pass.

      PULLED OUT OF THE FOCUS EFFECT DELIBERATELY. It used to live entirely
      inside useFocusEffect with weighTick as a dependency — which looks like
      it would re-run on a new weigh-in, and doesn't: a focus effect fires when
      the screen GAINS focus, and Stats already has it. So saving a weight
      changed nothing on screen until the user left the tab and came back,
      which read as the app taking thirty seconds to catch up. The save was
      always instant; the screen simply wasn't listening. */
  const loadAll = useCallback(async () => {
    if (!userId) { setLoaded(true); return; }

    const from = new Date();
    from.setDate(from.getDate() - 400);

    const [{ totals }, count, { entries }] = await Promise.all([
      loadDayTotals(userId, iso(from), todayLocal()),
      loggedDayCount(userId),
      loadWeighIns(userId),
    ]);

    if (!alive.current) return;

    setDayTotals(totals);
    setDaysLogged(count);
    setWeighIns(entries);
    setLoaded(true);
  }, [userId]);

  /* THE ONE THAT MAKES A WEIGH-IN APPEAR IMMEDIATELY. weighTick is bumped the
     moment the sheet reports a successful save, and this runs whether or not
     the screen is being re-entered. */
  useEffect(() => { loadAll(); }, [loadAll, weighTick]);

  /* and on returning to the tab, so a meal logged over in Camera shows up
     without a restart */
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  /* ---------- READING THE PHONE ----------
     A FULL YEAR of history, not just since signup. The phone has been counting
     steps since the day it was bought, so someone connecting today can see
     last January immediately — that's the whole appeal, and fetching only
     recent days would throw it away. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await isHealthAvailable();
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;

      setHealthLoading(true);
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);

      const [rows, hr] = await Promise.all([loadActivity(from, new Date()), recentHeartRate()]);
      if (cancelled) return;

      setActivity(rows);
      setBpm(hr);
      setHealthLoading(false);
    })();

    return () => { cancelled = true; };
  }, [healthTick]);

  const connectHealth = async () => {
    H.tap();
    setAsked(true);
    setHealthLoading(true);
    await requestHealthPermission();
    /* re-read rather than trusting the return value — see the note above about
       iOS never confirming read access */
    setHealthTick((k) => k + 1);
  };

  /* tapping the Stats tab while already on it drops back to the main view */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setView(null);
    setWeighOpen(false);
  }, [tabResetKey]);

  const goal = plan.calories;

  /* activity keyed by date, so the charts can look a day up directly */
  const actByDay = useMemo(() => {
    const m: Record<string, DayActivity> = {};
    activity.forEach((a) => { m[a.date] = a; });
    return m;
  }, [activity]);

  /* ---------- STEP BARS ----------
     Week shows days, Month shows weeks, Year shows months — and the zoomed-out
     views show TOTALS, because "247k steps in January" is the figure people
     actually want. Calories can't do that: a month's calorie total against a
     daily goal is meaningless, so those stay averages.

     LABELS ARE FULL WORDS AND FULL SPANS. "J F M A M J" is unreadable and two
     letters can't tell Jun from Jul; a bare "Jul 27" under a seven-day bar
     reads as a single day. Four bars in the Month view leaves room for the
     whole span over two lines, which is what it takes to be unambiguous. */
  const stepBars = useMemo((): { label: string; short: string; v: number }[] => {
    if (range === "Week") {
      const monday = mondayOf(0);
      return DAY_LABELS.map((label, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return { label, short: label, v: actByDay[iso(d)]?.steps || 0 };
      });
    }

    if (range === "Month") {
      return Array.from({ length: WEEKS_IN_MONTH }, (_, i) => {
        const weeksAgo = WEEKS_IN_MONTH - 1 - i;
        const monday = mondayOf(weeksAgo);
        let total = 0;
        for (let d = 0; d < 7; d++) {
          const day = new Date(monday);
          day.setDate(day.getDate() + d);
          total += actByDay[iso(day)]?.steps || 0;
        }
        const span = weekSpanLabel(weeksAgo);
        return { label: span, short: span, v: total };
      });
    }

    return MSHORT.slice(0, THIS_MONTH + 1).map((label, m) => {
      let total = 0;
      activity.forEach((a) => {
        const [y, mm] = a.date.split("-").map(Number);
        if (y === THIS_YEAR && mm - 1 === m) total += a.steps;
      });
      return { label, short: label, v: total };
    });
  }, [range, actByDay, activity]);

  const maxStep = useMemo(() => Math.max(1, ...stepBars.map((b) => b.v)), [stepBars]);
  const avgStepBar = useMemo(() => Math.round(avg(stepBars.map((b) => b.v))), [stepBars]);
  const totalSteps = useMemo(() => stepBars.reduce((a, b) => a + b.v, 0), [stepBars]);

  const stepHeadline = range === "Week"
    ? Math.round(avg(stepBars.map((b) => b.v)))
    : totalSteps;
  const stepUnit = range === "Week" ? "avg / day" : `this ${rangeWord}`;

  const today = actByDay[todayLocal()];
  const burnedToday = today?.burnedCalories || 0;
  const activeToday = today?.activeMinutes || 0;

  const stepsPerDay = useMemo(() => {
    if (range === "Week") return Math.round(avg(stepBars.map((b) => b.v)));
    const days = range === "Month" ? WEEKS_IN_MONTH * 7 : (THIS_MONTH + 1) * 30.4;
    return Math.round(totalSteps / days);
  }, [range, stepBars, totalSteps]);

  /* ---------- CALORIE BARS ----------
     A day with nothing logged is NULL, not zero. Zero would draw a bar
     claiming they ate nothing, which is a different and much worse claim
     than "we don't know about this day". */
  const bars = useMemo((): { label: string; v: number | null }[] => {
    if (range === "Week") {
      const monday = mondayOf(0);
      return DAY_LABELS.map((label, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        const v = dayTotals[iso(d)];
        return { label, v: v != null ? v : null };
      });
    }

    if (range === "Month") {
      return Array.from({ length: WEEKS_IN_MONTH }, (_, i) => {
        const weeksAgo = WEEKS_IN_MONTH - 1 - i;
        const monday = mondayOf(weeksAgo);
        const vals: number[] = [];
        for (let d = 0; d < 7; d++) {
          const day = new Date(monday);
          day.setDate(day.getDate() + d);
          const v = dayTotals[iso(day)];
          if (v != null) vals.push(v);
        }
        return {
          label: weekSpanLabel(weeksAgo),
          v: vals.length ? Math.round(avg(vals)) : null,
        };
      });
    }

    return MSHORT.slice(0, THIS_MONTH + 1).map((label, m) => {
      const vals: number[] = [];
      Object.entries(dayTotals).forEach(([k, v]) => {
        const [y, mm] = k.split("-").map(Number);
        if (y === THIS_YEAR && mm - 1 === m) vals.push(v);
      });
      return { label, v: vals.length ? Math.round(avg(vals)) : null };
    });
  }, [range, dayTotals]);

  const logged = useMemo(() => bars.map((b) => b.v).filter((v): v is number => v != null), [bars]);
  const periodAvg = useMemo(() => (logged.length ? Math.round(avg(logged) / 10) * 10 : 0), [logged]);
  const diff = goal - periodAvg;
  const hasCalData = logged.length > 0;

  const calLabelW = range === "Month" ? 78 : 40;
  const stepBarW = range === "Year" ? 12 : range === "Month" ? 24 : 17;

  /* ---------- weight ----------
     THE NEWEST READING, not an average of the last three. Averaging was built
     for people who weigh in daily; someone logging every few weeks got a
     number blended with month-old readings — a weight they hadn't been in
     ages, with nothing on screen to explain the difference. */
  const unit = profile.weightUnit;
  const currentKg = weighIns.length ? weighIns[weighIns.length - 1].weightKg : null;

  const changeKg = weighIns.length >= 2
    ? weighIns[weighIns.length - 1].weightKg - weighIns[0].weightKg
    : null;
  const shownChange = changeKg != null ? fromKg(changeKg, unit as "kg" | "lbs") : null;

  /* ---------- THE PLAN'S OWN NUMBERS ----------
     The chart draws a second line showing where the plan expects you to be,
     and that needs the same three inputs expectedKgToday() takes. They live on
     the profile in the USER'S unit, so they convert to kg here — everything
     downstream of this point is kg, exactly like weight.ts. */
  const startKg = toKg(profile.startWeight || 0, unit as "kg" | "lbs");
  const targetKg = toKg(profile.targetWeight || 0, unit as "kg" | "lbs");
  const paceKg = profile.paceRate || 0.5;

  /* signup_date comes back as "2026-08-19". Parsed by hand rather than with
     new Date(string), which reads a bare date as UTC and can land a day out. */
  const signupDate = useMemo(() => {
    if (!profile.memberSince) return new Date();
    const [y, m, d] = String(profile.memberSince).split("-").map(Number);
    return isNaN(y) || isNaN(m) || isNaN(d) ? new Date() : new Date(y, m - 1, d);
  }, [profile.memberSince]);

  const typicalCal = periodAvg;
  const typicalProtein = Math.round(plan.protein * 0.8);

  const Micro = ({ children }: { children: React.ReactNode }) => <Text style={s.micro}>{children}</Text>;

  const CalBar = ({ label, v, labelW }: { label: string; v: number | null; labelW: number }) => {
    if (v == null) {
      return (
        <View style={s.calBarRow}>
          <Text style={[s.calBarLabel, { width: labelW, color: T.micro }]} numberOfLines={1}>{label}</Text>
          <View style={s.calBarTrack}>
            <Text style={s.notLogged}>not logged</Text>
          </View>
        </View>
      );
    }
    const over = v - goal;
    const color = over <= 0 ? T.green : over <= goal * 0.17 ? T.orange : T.red;
    const pct = Math.max(30, Math.min(100, goal > 0 ? (v / (goal * 1.28)) * 100 : 30));
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
    if (!connected) {
      return (
        <View style={s.screen}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
            <BackHead title="Steps" onBack={() => setView(null)} />
            <ConnectPrompt
              T={T}
              s={s}
              available={available}
              loading={healthLoading}
              asked={asked}
              onConnect={connectHealth}
            />
          </ScrollView>
        </View>
      );
    }

    const refPct = Math.min(100, (avgStepBar / maxStep) * 100);

    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <BackHead title={`Steps · this ${rangeWord}`} onBack={() => setView(null)} />

          <View style={s.summaryRow}>
            <View style={s.summaryCard}>
              <Micro>{STEP_SUMMARY_LABEL[range]}</Micro>
              <Text style={s.summaryNum}>{avgStepBar.toLocaleString()}</Text>
            </View>
            <View style={s.summaryCard}>
              <Micro>Total this {rangeWord}</Micro>
              <Text style={s.summaryNum}>{totalSteps.toLocaleString()}</Text>
            </View>
          </View>

          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 16 }}>
              <View style={[s.rowBetween, { marginBottom: 14 }]}>
                <Text style={s.detailCaption}>{STEP_DETAIL_CAPTION[range]}</Text>
                <Text style={s.detailAvg}>avg {avgStepBar.toLocaleString()}</Text>
              </View>

              {stepBars.map((b, i) => {
                const above = b.v >= avgStepBar;
                const color = above ? T.green : T.orange;
                const pct = Math.max(34, Math.min(100, (b.v / maxStep) * 100));
                return (
                  <View key={i} style={s.stepBarRow}>
                    <Text style={s.stepBarLabel} numberOfLines={2}>{b.label}</Text>
                    <View style={s.stepBarTrack}>
                      <View style={[s.stepBarFill, { width: `${pct}%`, backgroundColor: color }]}>
                        <Text style={s.stepBarInside}>{b.v.toLocaleString()}</Text>
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
              ? "Straight from your phone's health data · MOTION never estimates steps"
              : `About ${stepsPerDay.toLocaleString()} steps a day across the ${rangeWord}. This includes days before you installed MOTION — your phone was already counting.`}
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
        dayTotals={dayTotals}
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
        unit={unit as "kg" | "lbs"}
        entries={weighIns}
        targetKg={targetKg}
        startKg={startKg}
        paceKgPerWeek={paceKg}
        signupDate={signupDate}
        range={range}
        onBack={() => setView(null)}
        onLog={() => setWeighOpen(true)}
        weighOpen={weighOpen}
        closeWeigh={() => setWeighOpen(false)}
        onSaved={() => setWeighTick((k) => k + 1)}
        lastKg={currentKg}
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
                  <Footprints size={15} color={T.green} />
                  <Micro>Steps · this {rangeWord}</Micro>
                </View>
                <View style={[s.sourceChip, !connected && { opacity: 0.45 }]}>
                  <Icon name="watchHealth" size={17} mode="loop" />
                  <Text style={s.sourceText}>
                    {connected ? "Health" : healthLoading ? "Reading…" : "Not connected"}
                  </Text>
                </View>
              </View>

              {!connected ? (
                <View style={s.stepsEmpty}>
                  {healthLoading ? (
                    <ActivityIndicator size="small" color={T.green} />
                  ) : (
                    <>
                      <Text style={s.stepsEmptyTitle}>
                        {available ? "Connect Apple Health" : "Health data isn't available here"}
                      </Text>
                      <Text style={s.stepsEmptyBody}>
                        {available
                          ? "Your phone has been counting steps since the day you got it. Connect and MOTION shows all of it — including months before you installed this."
                          : "This device doesn't have health data available. On Android you'll need the Health Connect app."}
                      </Text>
                      {available && (
                        <Tap onPress={connectHealth} style={{ width: "100%", marginTop: 6 }}>
                          <View style={s.connectBtn}>
                            <Text style={s.connectText}>Connect</Text>
                          </View>
                        </Tap>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <>
                  <View style={s.bigRow}>
                    <Text style={s.bigNum}>{stepHeadline.toLocaleString()}</Text>
                    <Text style={s.bigUnit}>{stepUnit}</Text>
                  </View>

                  {range !== "Week" && (
                    <Text style={s.stepSubNote}>about {stepsPerDay.toLocaleString()} a day</Text>
                  )}

                  <View style={s.chart}>
                    {stepBars.map((b, i) => (
                      <View key={i} style={s.barCol}>
                        <Text style={s.barVal}>{kfmt(b.v)}</Text>
                        <View style={s.barTrack}>
                          <LinearGradient
                            colors={["#22C55E", "#15803D"]}
                            style={[s.bar, { width: stepBarW, height: Math.max(4, (b.v / maxStep) * 68) }]}
                          />
                        </View>
                        {/* the Month view wraps to two lines so the whole span
                            fits — four bars is ~85px each, enough for
                            "Jul 27 – Aug 2" stacked */}
                        <Text
                          style={[
                            s.barLabel,
                            range === "Year" && s.barLabelTight,
                            range === "Month" && s.barLabelWrap,
                          ]}
                          numberOfLines={2}
                        >
                          {b.short}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={s.statsRow}>
                    <View style={{ alignItems: "center", flex: 1 }}>
                      <View style={s.statTop}>
                        <Icon name={freeLocked ? "flameSpark" : flameAnim} size={15} mode="loop" />
                        <Text style={s.statNum}>{burnedToday.toLocaleString()}</Text>
                      </View>
                      <Text style={s.micro}>Burned today</Text>
                    </View>
                    <Stat icon={Activity} v={String(activeToday)} l="Active min" />
                    <Stat v={bpm != null ? String(bpm) : "—"} l="Avg BPM" />
                  </View>
                </>
              )}

              <View style={s.cardFoot}>
                <Text style={s.cardFootText}>
                  {connected ? "Tap for the full breakdown" : "Tap to read more"}
                </Text>
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
                {hasCalData && (
                  <View style={s.rowGapTight}>
                    {diff >= 0 ? <TrendingDown size={12} color={T.green} /> : <TrendingUp size={12} color={T.red} />}
                    <Text style={[s.trendText, { color: diff >= 0 ? T.green : T.red }]}>
                      {Math.abs(diff)} {diff >= 0 ? "under" : "over"} avg
                    </Text>
                  </View>
                )}
              </View>

              <Text style={s.calCaption}>{CAL_CAPTION[range]}</Text>

              {bars.map((b, i) => (
                <CalBar key={i} label={b.label} v={b.v} labelW={calLabelW} />
              ))}

              {loaded && !hasCalData && (
                <Text style={s.noDataNote}>
                  Nothing logged in this {rangeWord} yet — log a meal and these bars fill in.
                </Text>
              )}

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
                      <Icon name="calendar" size={17} mode="loop" />
                    </View>
                    <View style={s.smallNumRow}>
                      <Text style={s.smallNum}>{daysLogged}</Text>
                      <View style={{ marginLeft: "auto" }}>
                        <Icon name={freeLocked ? "flameSpark" : flameAnim} size={18} mode="loop" />
                      </View>
                    </View>
                    <Text style={[s.smallNote, { color: T.orange }]}>
                      {daysLogged === 1 ? "day logged" : "days logged"} · view calendar
                    </Text>
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
                        <Text style={s.editTagText}>
                          {weighIns.length ? "TAP TO SEE" : "TAP TO LOG"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.smallNumRow}>
                      <Text style={s.smallNum}>
                        {shownChange != null
                          ? `${shownChange > 0 ? "+" : ""}${shownChange.toFixed(1)}`
                          : currentKg != null
                            ? fromKg(currentKg, unit as "kg" | "lbs").toFixed(1)
                            : "—"}
                      </Text>
                      <Text style={s.smallUnit}>{unit}</Text>
                      <View style={{ marginLeft: "auto" }}>
                        <Icon name="scale" size={18} mode="loop" />
                      </View>
                    </View>
                    <Text style={[s.smallNote, { color: T.green }]}>
                      {shownChange != null
                        ? "since your first weigh-in"
                        : currentKg != null
                          ? "one weigh-in · log another"
                          : "no weigh-ins yet"}
                    </Text>
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
                  [hasCalData ? typicalCal.toLocaleString() : "—", "cal"],
                  [hasCalData ? `${typicalProtein}g` : "—", "protein"],
                  [connected ? stepsPerDay.toLocaleString() : "—", "steps"],
                ].map(([v, l]) => (
                  <View key={l} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.typicalNum}>{v}</Text>
                    <Text style={s.typicalLabel}>{l.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.typicalFoot}>
                {hasCalData || connected
                  ? "Calories from your logs · steps from your phone · never estimated"
                  : "Fills in as you log · averaged from your own days, never estimated"}
              </Text>
            </View>
          </TravelBorder>
        </View>
      </ScrollView>

      <WeighInSheet
        visible={weighOpen}
        onClose={() => setWeighOpen(false)}
        onSaved={() => setWeighTick((k) => k + 1)}
        lastKg={currentKg}
      />
    </View>
  );
}

/* ---------- the connect prompt ----------
   Says what MOTION reads, what it does with it, and what it never does.
   iOS shows its own permission sheet a second later, and someone who's just
   read this is far more likely to allow it.

   The line about permission being awkward to undo is deliberate but gentle.
   It's true — iOS buries Health permissions several screens deep in Settings —
   and knowing that up front is what makes someone read the list properly
   rather than dismissing it. It is NOT a threat: the tone is "worth doing now
   because it's fiddly later", not "you only get one chance". */
function ConnectPrompt({
  T, s, available, loading, asked, onConnect,
}: {
  T: any;
  s: any;
  available: boolean;
  loading: boolean;
  asked: boolean;
  onConnect: () => void;
}) {
  const rows: { anim: IconName; t: string; d: string }[] = [
    { anim: "stopwatch", t: "Steps and active minutes", d: "Every day your phone has recorded" },
    { anim: "flameUltimate", t: "Calories burned", d: "Feeds your daily energy balance" },
    { anim: "heartRed", t: "Heart rate", d: "Your average over the week" },
  ];

  return (
    <View style={{ paddingTop: 10 }}>
      <View style={{ alignItems: "center", marginBottom: 18 }}>
        <Icon name="watchHealth" size={54} mode="loop" />
      </View>

      <Text style={s.emptyTitle}>
        {available ? "Connect your health data" : "Health data isn't available"}
      </Text>

      <Text style={[s.emptyBody, { marginTop: 10 }]}>
        {available
          ? "Your phone has been counting steps since the day you bought it — long before MOTION existed. Connect and all of that history appears here, week by week and month by month."
          : "This device doesn't expose health data. On Android that usually means the Health Connect app isn't installed."}
      </Text>

      {available && (
        <>
          <View style={s.permCard}>
            {rows.map((r, k) => (
              <View key={k} style={[s.permRow, k > 0 && s.permRowBorder]}>
                <View style={s.permRowIcon}>
                  <Icon name={r.anim} size={22} mode="loop" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.permRowTitle}>{r.t}</Text>
                  <Text style={s.permRowSub}>{r.d}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={s.permNote}>
            MOTION only READS this data. It never writes to Health, never changes anything, and
            never shares it with anyone.
          </Text>

          {/* the honest heads-up: it's easier to allow now than to fix later */}
          <View style={s.tipCard}>
            <Text style={s.tipTitle}>Worth allowing all of it</Text>
            <Text style={s.tipBody}>
              iOS asks on the next screen. If you turn something off there, switching it back on
              means digging through Settings → Privacy &amp; Security → Health → MOTION — several
              screens deep, and easy to give up on.
              {"\n\n"}
              Allowing everything now is what makes your weekly, monthly and yearly step history
              work.
            </Text>
          </View>

          {/* they've tried and nothing came back — most likely a decline, so
              offer the one thing that actually helps rather than repeating the
              same button */}
          {asked && !loading && (
            <View style={s.retryCard}>
              <Text style={s.retryTitle}>Nothing came through</Text>
              <Text style={s.retryBody}>
                That usually means permission is off, or this phone has no health data recorded yet.
                You can turn it on in Settings → Privacy &amp; Security → Health → MOTION.
              </Text>
              <Tap onPress={() => Linking.openSettings()} style={{ marginTop: 12 }}>
                <View style={s.retryBtn}>
                  <Text style={s.retryBtnText}>Open Settings</Text>
                </View>
              </Tap>
            </View>
          )}

          <Tap onPress={onConnect} style={{ marginTop: 18 }}>
            <View style={[s.connectBtn, loading && { opacity: 0.6 }]}>
              <Text style={s.connectText}>
                {loading ? "Reading…" : asked ? "Try again" : "Connect health data"}
              </Text>
            </View>
          </Tap>
        </>
      )}
    </View>
  );
}

/* ---------- one week card ---------- */
function WeekCard({
  T, s, wk, goal, animate, last,
}: {
  T: any;
  s: any;
  wk: { key: string; span: string; current: boolean; vals: (number | null)[] };
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

  const real = wk.vals.filter((v): v is number => v != null);
  const weekAvg = real.length ? Math.round(avg(real)) : 0;
  const under = real.filter((v) => v <= goal).length;

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
            <Text style={s.histAvg}>
              {real.length
                ? `avg ${weekAvg.toLocaleString()} · ${under}/${real.length} under`
                : "nothing logged"}
            </Text>
          </View>

          {wk.vals.map((v, i) => {
            if (v == null) {
              return (
                <View key={i} style={s.calBarRow}>
                  <Text style={[s.calBarLabel, { width: 40, color: T.micro }]}>{DAY_LABELS[i]}</Text>
                  <View style={s.calBarTrack}>
                    <Text style={s.notLogged}>not logged</Text>
                  </View>
                </View>
              );
            }
            const over = v - goal;
            const color = over <= 0 ? T.green : over <= goal * 0.17 ? T.orange : T.red;
            const pct = Math.max(30, Math.min(100, goal > 0 ? (v / (goal * 1.28)) * 100 : 30));
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
  T, s, goal, dayTotals, freeLocked, onBack, onGoPro,
}: {
  T: any;
  s: any;
  goal: number;
  dayTotals: Record<string, number>;
  freeLocked: boolean;
  onBack: () => void;
  onGoPro: () => void;
}) {
  const BATCH = 4;
  const FREE_CAP = 2;
  const HOLD_MS = 1200;
  const STEP_MS = 1000;

  /* how many weeks back there's anything to show. No point offering to load
     twelve weeks of history to someone who signed up on Tuesday. */
  const total = useMemo(() => {
    const keys = Object.keys(dayTotals);
    if (!keys.length) return 1;
    const oldest = keys.sort()[0];
    const [y, m, d] = oldest.split("-").map(Number);
    const weeks = Math.ceil((Date.now() - new Date(y, m - 1, d).getTime()) / (7 * 86400000));
    return Math.max(1, Math.min(52, weeks));
  }, [dayTotals]);

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
    return Array.from({ length: shown }, (_, i) => {
      const weeksAgo = shown - 1 - i;
      const monday = mondayOf(weeksAgo);
      const vals: (number | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(monday);
        day.setDate(day.getDate() + d);
        const v = dayTotals[iso(day)];
        vals.push(v != null ? v : null);
      }
      return {
        key: `w${weeksAgo}`,
        span: weekSpanLabel(weeksAgo),
        current: weeksAgo === 0,
        vals,
      };
    });
  }, [shown, dayTotals]);

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

/* ---------- weight history ----------
   THE ONLY PLACE A WEIGHT IS ENTERED. Home shows where the plan expects you to
   be and hands off here; recording the number in two places is how two numbers
   end up disagreeing.

   THE CHART IS A LINE, not columns. A column only means something next to
   other columns, so a single weigh-in rendered as one lonely bar said nothing
   at all. The line carries a second, dashed line showing where the plan
   expects you to be — which is the comparison people actually came for, and
   which gives even a first reading something to sit against.

   EVERYTHING IN HERE IS KG until the moment it's displayed. targetKg arrives
   already converted — it used to arrive in the user's own unit and then get
   run through fromKg() a second time, which multiplied an lbs target by 2.2. */
function WeightView({
  T, s, unit, entries, targetKg, startKg, paceKgPerWeek, signupDate, range,
  onBack, onLog, weighOpen, closeWeigh, onSaved, lastKg,
}: {
  T: any;
  s: any;
  unit: "kg" | "lbs";
  entries: WeighIn[];
  targetKg: number;
  startKg: number;
  paceKgPerWeek: number;
  signupDate: Date;
  range: "Week" | "Month" | "Year";
  onBack: () => void;
  onLog: () => void;
  weighOpen: boolean;
  closeWeigh: () => void;
  onSaved: () => void;
  lastKg: number | null;
}) {
  const vals = entries.map((e) => fromKg(e.weightKg, unit));

  const change = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
  const pace = actualPacePerWeek(entries);
  const paceShown = pace != null ? fromKg(pace, unit) : null;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <Pressable onPress={onBack} style={s.backRow} hitSlop={10}>
          <ChevronLeft size={24} color={T.text} />
          <Text style={s.backTitle}>Your weight</Text>
        </Pressable>

        {entries.length === 0 ? (
          <View style={s.emptyStage}>
            <Icon name="scale" size={54} mode="loop" />
            <Text style={s.emptyTitle}>No weigh-ins yet</Text>
            <Text style={s.emptyBody}>
              Log your weight and MOTION starts tracking the real trend rather than the estimate
              from your plan.
              {"\n\n"}
              Weigh yourself at the same time each day if you can — first thing, before eating, is
              the most consistent. Day-to-day swings are mostly water, so it's the line over weeks
              that matters.
            </Text>
            <Tap onPress={onLog} style={{ width: "100%", maxWidth: 260, marginTop: 6 }}>
              <View style={s.saveBtn}>
                <Text style={s.saveText}>Log your weight</Text>
              </View>
            </Tap>
          </View>
        ) : (
          <>
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.micro}>NOW</Text>
                <Text style={s.summaryNum}>
                  {vals[vals.length - 1].toFixed(1)} <Text style={s.summaryUnit}>{unit}</Text>
                </Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={s.micro}>CHANGE</Text>
                <Text style={[s.summaryNum, change != null && { color: change <= 0 ? T.green : T.orange }]}>
                  {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "—"}
                  <Text style={s.summaryUnit}> {unit}</Text>
                </Text>
              </View>
            </View>

            <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
              <View style={{ padding: 16 }}>
                <View style={[s.rowBetween, { marginBottom: 14 }]}>
                  <Text style={s.detailCaption}>
                    {entries.length} {entries.length === 1 ? "weigh-in" : "weigh-ins"}
                  </Text>
                  {paceShown != null && (
                    <Text style={s.detailAvg}>
                      {paceShown > 0 ? "+" : ""}{paceShown.toFixed(2)} {unit}/week
                    </Text>
                  )}
                </View>

                <WeightChart
                  T={T}
                  unit={unit}
                  entries={entries}
                  startKg={startKg}
                  targetKg={targetKg}
                  paceKgPerWeek={paceKgPerWeek}
                  signupDate={signupDate}
                  range={range}
                />

                {entries.length === 1 && (
                  <Text style={s.noDataNote}>
                    One reading is a starting point, not a trend. Log again in a few days and the
                    line starts to mean something.
                  </Text>
                )}
              </View>
            </TravelBorder>

            <Tap onPress={onLog} style={{ marginTop: 16 }}>
              <View style={s.saveBtn}>
                <Text style={s.saveText}>Log today's weight</Text>
              </View>
            </Tap>

            <Text style={s.weightFoot}>
              {targetKg
                ? `Target ${fromKg(targetKg, unit).toFixed(1)} ${unit}. Day-to-day swings are mostly water — it's the direction over weeks that counts.`
                : "Day-to-day swings are mostly water — it's the direction over weeks that counts."}
            </Text>
          </>
        )}
      </ScrollView>

      <WeighInSheet visible={weighOpen} onClose={closeWeigh} onSaved={onSaved} lastKg={lastKg} />
    </View>
  );
}

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
    /* twelve three-letter months across a phone is snug — this is the size
       that fits "Sep" without clipping */
    barLabelTight: { fontSize: 7.5 },
    /* four bars means ~85px each — enough for the whole span over two lines,
       which is what it takes for a week bar to read as a week */
    barLabelWrap: { fontSize: 7.5, textAlign: "center", lineHeight: 10, paddingHorizontal: 2 },

    statsRow: { flexDirection: "row", marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
    statTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    statNum: { fontSize: 18, color: T.text, fontFamily: FONTS.heading },

    stepsEmpty: { paddingVertical: 22, alignItems: "center", gap: 9 },
    stepsEmptyTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, textAlign: "center" },
    stepsEmptyBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 17, paddingHorizontal: 8 },

    connectBtn: { backgroundColor: T.green, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    connectText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },

    emptyStage: { alignItems: "center", gap: 14, paddingTop: 30, paddingHorizontal: 8 },
    emptyTitle: { fontSize: 18, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    emptyBody: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 20 },

    permCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, marginTop: 22, overflow: "hidden" },
    permRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
    permRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
    permRowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    permRowTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    permRowSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    permNote: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, marginTop: 14, lineHeight: 17 },

    tipCard: {
      marginTop: 18, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, padding: 15,
    },
    tipTitle: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed, marginBottom: 7 },
    tipBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    retryCard: {
      marginTop: 16, backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 14, padding: 15,
    },
    retryTitle: { fontSize: 13, color: T.gold, fontFamily: FONTS.headingMed, marginBottom: 6 },
    retryBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },
    retryBtn: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, paddingVertical: 11, alignItems: "center" },
    retryBtnText: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },

    cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 },
    cardFootText: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },

    trendText: { fontSize: 11, fontFamily: FONTS.headingMed },
    calCaption: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginBottom: 12 },
    noDataNote: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 10, lineHeight: 16 },

    calBarRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 },
    calBarLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
    calBarTrack: { flex: 1, height: 26, borderRadius: 8, backgroundColor: T.track, overflow: "hidden", justifyContent: "center" },
    calBarFill: { height: "100%", borderRadius: 8, alignItems: "flex-end", justifyContent: "center", paddingRight: 10 },
    calBarInside: { fontSize: 10.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    notLogged: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, paddingLeft: 10 },

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
    summaryUnit: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },

    detailCaption: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, flex: 1 },
    detailAvg: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed },
    detailFoot: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 16, lineHeight: 16 },

    stepBarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    stepBarLabel: { width: 74, fontSize: 10, color: T.sub, fontFamily: FONTS.body, lineHeight: 13 },
    stepBarTrack: { flex: 1, height: 28, borderRadius: 8, backgroundColor: T.track, overflow: "hidden", position: "relative" },
    stepBarFill: { height: "100%", borderRadius: 8, alignItems: "flex-end", justifyContent: "center", paddingRight: 8 },
    stepBarInside: { fontSize: 11, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    refLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: T.text, opacity: 0.5, borderRadius: 2 },

    /* weight chart — the column styles below are no longer used by
       WeightView (it renders components/WeightChart.tsx now) and are kept
       only so nothing else that might reference them breaks */
    wChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 138 },
    wCol: { alignItems: "center", gap: 4, flex: 1 },
    wVal: { fontSize: 8, color: T.sub, fontFamily: FONTS.headingMed },
    wTrack: { height: 90, justifyContent: "flex-end" },
    wBar: { width: 14, borderRadius: 5 },
    wLabel: { fontSize: 8, color: T.micro, fontFamily: FONTS.heading, textAlign: "center", lineHeight: 10 },

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

    saveBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    saveText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
    weightFoot: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14, lineHeight: 15 },
  });