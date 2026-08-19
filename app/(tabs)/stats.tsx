// app/(tabs)/stats.tsx
// Stats is one tab holding four views — main, steps, calories, weight — swapped
// by a single `view` state rather than routing, so the tab bar stays put.
//
// WHAT'S REAL AND WHAT ISN'T:
//   Calories    — real, summed from logged meals
//   Consistency — real, counted from logged days
//   Weight      — real, from weigh-ins
//   Steps       — NOT POSSIBLE YET. Needs HealthKit, which needs a
//                 development build. Rather than show invented numbers, the
//                 widget says what it's waiting for. A chart that lies is
//                 worse than a chart that's empty, because you can't tell.
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowDown, ChevronLeft, Crown, Footprints, Lock, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import Icon, { IconName } from "../../components/Icon";
import { IsoMGlow } from "../../components/IsoM";
import PageHeader from "../../components/PageHeader";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import WeighInSheet from "../../components/WeighInSheet";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";
import { loadDayTotals, loggedDayCount, todayLocal } from "../../constants/meals";
import { FONTS, tierForStreak } from "../../constants/theme";
import { actualPacePerWeek, fromKg, loadWeighIns, smoothedKg, WeighIn } from "../../constants/weight";

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

export default function Stats() {
  const router = useRouter();
  const { T, freeLocked, plan, profile, openPaywall, tabResetKey, streakDays, settings, userId } = useApp();
  const [range, setRange] = useState<Range>("Week");
  const [view, setView] = useState<View_>(null);

  const s = styles(T);
  const rangeWord = RANGE_WORD[range];

  const tier = tierForStreak(streakDays);
  const flameAnim = FLAME_FOR_TIER[tier.name] || "flameSpark";

  /* ---------- REAL DATA ---------- */
  /* every day with anything logged, across 400 days — one query feeds the
     week, month and year charts, so switching range costs nothing */
  const [dayTotals, setDayTotals] = useState<Record<string, number>>({});
  const [daysLogged, setDaysLogged] = useState(0);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [weighOpen, setWeighOpen] = useState(false);
  const [weighTick, setWeighTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!userId) { setLoaded(true); return; }

      (async () => {
        const from = new Date();
        from.setDate(from.getDate() - 400);

        const [{ totals }, count, { entries }] = await Promise.all([
          loadDayTotals(userId, iso(from), todayLocal()),
          loggedDayCount(userId),
          loadWeighIns(userId),
        ]);
        if (cancelled) return;

        setDayTotals(totals);
        setDaysLogged(count);
        setWeighIns(entries);
        setLoaded(true);
      })();

      return () => { cancelled = true; };
    }, [userId, weighTick])
  );

  /* tapping the Stats tab while already on it drops back to the main view */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setView(null);
    setWeighOpen(false);
  }, [tabResetKey]);

  const goal = plan.calories;

  /* ---------- the calorie bars, from real logged days ----------
     A day with nothing logged is NULL, not zero. Zero would draw a bar
     claiming they ate nothing, which is a different and much worse claim than
     "we don't know about this day". */
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
      /* last four weeks, oldest first, each bar the average of its LOGGED
         days — averaging in the blanks would drag every week downward */
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

    /* the calendar year so far, each month an average logged day */
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

  /* ---------- weight ---------- */
  const unit = profile.weightUnit;
  const currentKg = smoothedKg(weighIns);
  const paceKg = actualPacePerWeek(weighIns);

  /* change since the FIRST weigh-in, which is the only honest baseline —
     comparing to the onboarding estimate would report a "change" that's
     really just the gap between a guess and a measurement */
  const changeKg = weighIns.length >= 2
    ? weighIns[weighIns.length - 1].weightKg - weighIns[0].weightKg
    : null;
  const shownChange = changeKg != null ? fromKg(changeKg, unit as "kg" | "lbs") : null;

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

  const BackHead = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <Pressable onPress={onBack} style={s.backRow} hitSlop={10}>
      <ChevronLeft size={24} color={T.text} />
      <Text style={s.backTitle}>{title}</Text>
    </Pressable>
  );

  /* ================= STEPS DETAIL ================= */
  if (view === "steps") {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <BackHead title="Steps" onBack={() => setView(null)} />

          <View style={s.emptyStage}>
            <Icon name="watchHealth" size={54} mode="loop" />
            <Text style={s.emptyTitle}>Steps come from your phone</Text>
            <Text style={s.emptyBody}>
              MOTION reads your step count, active minutes and calories burned straight from Apple
              Health — it never estimates them, because a guessed step count is worse than none.
              {"\n\n"}
              Health sync arrives with the next build. Once it's connected, this screen fills in
              your history — including months you walked before you ever installed MOTION.
            </Text>
          </View>
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
        target={profile.targetWeight}
        onBack={() => setView(null)}
        onLog={() => setWeighOpen(true)}
        weighOpen={weighOpen}
        closeWeigh={() => setWeighOpen(false)}
        onSaved={() => setWeighTick((k) => k + 1)}
        lastKg={weighIns.length ? weighIns[weighIns.length - 1].weightKg : null}
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

        {/* WIDGET 1 — STEPS. Empty, and says why.
            An invented step count would be indistinguishable from a real one,
            which makes every other number on this screen suspect too. */}
        <Tap onPress={() => setView("steps")}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
            <View style={{ padding: 18 }}>
              <View style={s.rowBetween}>
                <View style={s.rowGap}>
                  <Footprints size={15} color={T.green} />
                  <Micro>Steps · this {rangeWord}</Micro>
                </View>
                <View style={[s.sourceChip, !settings.watch && { opacity: 0.45 }]}>
                  <Icon name="watchHealth" size={17} mode="loop" />
                  <Text style={s.sourceText}>Not connected</Text>
                </View>
              </View>

              <View style={s.stepsEmpty}>
                <Text style={s.stepsEmptyTitle}>Connect Apple Health for your steps</Text>
                <Text style={s.stepsEmptyBody}>
                  Steps, active minutes and calories burned come from your phone, not from
                  MOTION guessing. Available in the next build.
                </Text>
              </View>

              <View style={s.cardFoot}>
                <Text style={s.cardFootText}>Tap to read more</Text>
                <TrendingUp size={12} color={T.green} />
              </View>
            </View>
          </TravelBorder>
        </Tap>

        {/* WIDGET 2 — CALORIES VS GOAL. Real, from logged meals. */}
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
                      {/* the CHANGE if there's enough history for one, the
                          current weight if there's only one reading, and a
                          dash if they've never weighed in — each is true */}
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
                        ? `since your first weigh-in`
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
                  ["—", "steps"],
                ].map(([v, l]) => (
                  <View key={l} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.typicalNum}>{v}</Text>
                    <Text style={s.typicalLabel}>{l.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.typicalFoot}>
                {hasCalData
                  ? "Averaged from your logged days · steps arrive with Health sync"
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
        lastKg={weighIns.length ? weighIns[weighIns.length - 1].weightKg : null}
      />
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

  /* each week built from the real day totals — a day with nothing logged
     stays null rather than becoming a zero-calorie bar */
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
   A CHART, not an editor. Logging happens in one place — the weigh-in sheet —
   because two ways to record the same number is how two numbers end up
   disagreeing. */
function WeightView({
  T, s, unit, entries, target, onBack, onLog, weighOpen, closeWeigh, onSaved, lastKg,
}: {
  T: any;
  s: any;
  unit: "kg" | "lbs";
  entries: WeighIn[];
  target: number;
  onBack: () => void;
  onLog: () => void;
  weighOpen: boolean;
  closeWeigh: () => void;
  onSaved: () => void;
  lastKg: number | null;
}) {
  const vals = entries.map((e) => fromKg(e.weightKg, unit));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  /* a little headroom so the highest and lowest points aren't glued to the
     edges — and a floor on the span, or two near-identical readings would
     render as a dramatic cliff */
  const span = Math.max(2, max - min);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

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

                {/* a plain column chart. Every bar is a real reading — no
                    interpolation between them, because a smooth line would
                    imply measurements nobody took. */}
                <View style={s.wChart}>
                  {entries.slice(-14).map((e, i) => {
                    const v = fromKg(e.weightKg, unit);
                    const h = hi > lo ? ((v - lo) / (hi - lo)) * 90 : 45;
                    const [, m, d] = e.measuredOn.split("-").map(Number);
                    return (
                      <View key={e.id || i} style={s.wCol}>
                        <Text style={s.wVal}>{v.toFixed(1)}</Text>
                        <View style={s.wTrack}>
                          <LinearGradient
                            colors={["#22C55E", "#15803D"]}
                            style={[s.wBar, { height: Math.max(6, h) }]}
                          />
                        </View>
                        <Text style={s.wLabel}>{MSHORT[m - 1]?.[0]}{d}</Text>
                      </View>
                    );
                  })}
                </View>

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
              {target
                ? `Target ${fromKg(target, unit).toFixed(1)} ${unit}. Day-to-day swings are mostly water — it's the direction over weeks that counts.`
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

    stepsEmpty: { paddingVertical: 22, alignItems: "center", gap: 8 },
    stepsEmptyTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, textAlign: "center" },
    stepsEmptyBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 17, paddingHorizontal: 8 },

    emptyStage: { alignItems: "center", gap: 14, paddingTop: 30, paddingHorizontal: 8 },
    emptyTitle: { fontSize: 18, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    emptyBody: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 20 },

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

    /* weight chart */
    wChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 130 },
    wCol: { alignItems: "center", gap: 4, flex: 1 },
    wVal: { fontSize: 8, color: T.sub, fontFamily: FONTS.headingMed },
    wTrack: { height: 90, justifyContent: "flex-end" },
    wBar: { width: 14, borderRadius: 5 },
    wLabel: { fontSize: 8, color: T.micro, fontFamily: FONTS.heading },

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