// app/(tabs)/calendar.tsx
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Lock, Mic, Sparkles, X } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon, { IconMode, IconName } from "../../components/Icon";
import PageHeader from "../../components/PageHeader";
import StreakReel from "../../components/StreakReel";
import StreakWarnCard from "../../components/StreakWarnCard";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { FONTS, TIERS, ULT_COLORS } from "../../constants/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const TILE_SIZE = 52;

/* ---------- the tile flames ----------
   A full month can be 30 lit tiles, and each one ALREADY runs a TravelBorder.
   Adding a looping Lottie to every tile roughly doubles the animation load on
   the heaviest screen in the app — so this is one switch rather than thirty:

     "loop"  — every lit tile burns. What we want if the device can take it.
     "still" — first frame only, no animation cost. The tiles still wear their
               tier flame, they just don't move.

   If the month grid stutters or scrolling back through months drags, change
   this one word. The tier colours and everything else stay exactly as they are. */
const TILE_FLAME_MODE: IconMode = "loop";
const TILE_FLAME_SIZE = 15;

/** the flame animation for a tier — a dedicated file per tier reads far better
    than one generic flame tinted five ways */
const FLAME_FOR_TIER: Record<string, IconName> = {
  Spark: "flameSpark",
  Warming: "flameWarming",
  Hot: "flameHot",
  "Red-hot": "flameRedhot",
  Ultimate: "flameUltimate",
};

/* ---------- the real calendar maths ----------
   Everything below is derived from actual dates. No hardcoded month length,
   no fixed weekday offset, no constant "today". */

const TODAY = new Date();
const TODAY_Y = TODAY.getFullYear();
const TODAY_M = TODAY.getMonth();
const TODAY_D = TODAY.getDate();

const key = (y: number, m: number, d: number) => `${y}-${m}-${d}`;

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** the grid: leading blanks so the 1st lands under the right weekday */
function buildGrid(year: number, month: number): (number | null)[] {
  return [
    ...Array.from({ length: firstWeekday(year, month) }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
  ];
}

function isFuture(year: number, month: number, day: number) {
  if (year !== TODAY_Y) return year > TODAY_Y;
  if (month !== TODAY_M) return month > TODAY_M;
  return day > TODAY_D;
}

function isToday(year: number, month: number, day: number) {
  return year === TODAY_Y && month === TODAY_M && day === TODAY_D;
}

/* ---------- logged days ----------
   Stand-in until the backend stores real logs. 74 days of history counting
   back from today, with deliberate gaps: the current run reaches 19 days
   (Ultimate), and the misses show what a broken streak looks like and how the
   run restarts at Spark. Replace MISSED_AGO + HISTORY_DAYS with real data and
   every tile, tier and flame below follows automatically. */
const HISTORY_DAYS = 74;
const MISSED_AGO = [19, 20, 41]; // days before today that were NOT logged

function buildLogged(): Set<string> {
  const set = new Set<string>();
  const d = new Date(TODAY_Y, TODAY_M, TODAY_D);
  for (let i = 0; i < HISTORY_DAYS; i++) {
    if (!MISSED_AGO.includes(i)) set.add(key(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setDate(d.getDate() - 1);
  }
  return set;
}

/** how many consecutive days had been logged up to and including this one —
    that run length is what decides the tier the tile wears */
function runLengthAt(logged: Set<string>, year: number, month: number, day: number) {
  let run = 0;
  const d = new Date(year, month, day);
  while (logged.has(key(d.getFullYear(), d.getMonth(), d.getDate()))) {
    run++;
    d.setDate(d.getDate() - 1);
  }
  return run;
}

function tierIndexForRun(run: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (run <= 0) return 0;
  if (run <= 4) return 1;
  if (run <= 8) return 2;
  if (run <= 12) return 3;
  if (run <= 16) return 4;
  return 5;
}

/* ---------- the free colour window ----------
   Free users keep tier colours for 30 days from signup, then the calendar goes
   plain while the streak keeps counting. Stand-in signup date until the backend
   stores the real one — set 24 days ago so the countdown reads 6 days. */
const SIGNUP = new Date(TODAY_Y, TODAY_M, TODAY_D - 24);
const FREE_WINDOW_DAYS = 30;
const FADE_DATE = new Date(SIGNUP.getFullYear(), SIGNUP.getMonth(), SIGNUP.getDate() + FREE_WINDOW_DAYS);
const DAYS_LEFT = Math.ceil((FADE_DATE.getTime() - TODAY.getTime()) / 86400000);

const DAY_MEALS = [
  { name: "Breakfast", time: "8:15 AM", title: "Scrambled eggs & avocado", cal: 430, pct: 22, voice: true, icon: "breakfast" as IconName },
  { name: "Lunch", time: "12:41 PM", title: "Grilled chicken & rice", cal: 620, pct: 31, voice: false, icon: "lunch" as IconName },
  { name: "Dinner", time: "7:20 PM", title: "Salmon, greens & potato", cal: 700, pct: 35, voice: true, icon: "dinner" as IconName },
];

/* ---------- the date jump ----------
   Three wheels — day, month, year — same feel as the birthday picker in
   onboarding. Lands on a specific day, so it opens that month with the day
   already selected and goes straight to its recap. */
const ROW_H = 38;
const YEARS = Array.from({ length: 6 }, (_, i) => TODAY_Y - 4 + i);

function Wheel({
  values,
  labels,
  value,
  onChange,
  disabled,
  width,
  T,
}: {
  values: number[];
  labels: string[];
  value: number;
  onChange: (v: number) => void;
  disabled?: (v: number) => boolean;
  width: number;
  T: any;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));
  const s = wheelStyles(T);

  return (
    <ScrollView
      ref={ref}
      style={{ width, height: ROW_H * 5 }}
      contentContainerStyle={{ paddingVertical: ROW_H * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_H}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: idx * ROW_H }}
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / ROW_H);
        const v = values[Math.min(values.length - 1, Math.max(0, i))];
        if (v != null && !disabled?.(v)) onChange(v);
        else ref.current?.scrollTo({ y: idx * ROW_H, animated: true });
      }}
    >
      {values.map((v, i) => {
        const off = disabled?.(v);
        const active = v === value;
        return (
          <View key={v} style={{ height: ROW_H, alignItems: "center", justifyContent: "center" }}>
            <Text style={[s.wheelText, active && s.wheelActive, off && s.wheelOff]}>{labels[i]}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function Calendar() {
  const { T, freeLocked, openPaywall, plan } = useApp();

  const [year, setYear] = useState(TODAY_Y);
  const [month, setMonth] = useState(TODAY_M);
  const [day, setDay] = useState<number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pY, setPY] = useState(TODAY_Y);
  const [pM, setPM] = useState(TODAY_M);
  const [pD, setPD] = useState(TODAY_D);

  const [reelOpen, setReelOpen] = useState(false);

  const s = styles(T);

  const logged = useMemo(() => buildLogged(), []);
  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  const prevMonth = () => {
    setDay(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setDay(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const atCurrentMonth = year === TODAY_Y && month === TODAY_M;
  const canGoNext = !atCurrentMonth;

  const openPicker = () => {
    setPY(year);
    setPM(month);
    setPD(Math.min(day ?? TODAY_D, daysInMonth(year, month)));
    setPickerOpen(true);
  };

  const applyPicker = () => {
    const maxD = daysInMonth(pY, pM);
    const d = Math.min(pD, maxD);
    setYear(pY);
    setMonth(pM);
    // land straight on the day's recap if there's something logged there
    setDay(logged.has(key(pY, pM, d)) && !isFuture(pY, pM, d) ? d : null);
    setPickerOpen(false);
  };

  const jumpToday = () => {
    setYear(TODAY_Y);
    setMonth(TODAY_M);
    setDay(null);
    setPickerOpen(false);
  };

  // months ahead of today are unreachable — nothing is logged in the future
  const monthDisabled = (m: number) => pY > TODAY_Y || (pY === TODAY_Y && m > TODAY_M);
  const yearDisabled = (y: number) => y > TODAY_Y;
  const dayDisabled = (d: number) => {
    if (d > daysInMonth(pY, pM)) return true;
    return isFuture(pY, pM, d);
  };

  const Micro = ({ children }: { children: React.ReactNode }) => <Text style={s.micro}>{children}</Text>;

  /* ---------- one day tile ---------- */
  const DayTile = ({ d }: { d: number | null }) => {
    if (d == null) return <View style={s.cell} />;

    const future = isFuture(year, month, d);
    const today = isToday(year, month, d);
    const isLogged = logged.has(key(year, month, d));

    if (future || !isLogged) {
      return (
        <View style={s.cell}>
          <View style={[
            s.tileBox,
            { backgroundColor: T.emptyTile, borderWidth: 1, borderColor: today ? T.green : T.border },
          ]}>
            <Text style={[s.dayNum, { color: today ? T.green : T.micro }]}>{d}</Text>
          </View>
        </View>
      );
    }

    if (freeLocked) {
      return (
        <Tap onPress={() => setDay(d)} style={s.cell}>
          <View style={[s.tileBox, { backgroundColor: T.card, borderWidth: 1, borderColor: today ? T.green : T.border }]}>
            <Text style={[s.dayNum, s.dayNumOverlay, { color: T.text }]}>{d}</Text>
            <Text style={s.plainCheck}>✓</Text>
          </View>
        </Tap>
      );
    }

    const run = runLengthAt(logged, year, month, d);
    const t = TIERS[tierIndexForRun(run) as 1 | 2 | 3 | 4 | 5];
    const isUlt = t.color === "ultimate";
    const flame = FLAME_FOR_TIER[t.name] || "flameSpark";

    if (isUlt) {
      return (
        <Tap onPress={() => setDay(d)} style={s.cell}>
          <View style={s.tileWrap}>
            <TravelBorder colors={ULT_COLORS} cardBg="#3B1A4A" borderColor={T.border} radius={12} strokeWidth={2.5}>
              <View style={s.tileInner} />
            </TravelBorder>
            <Text style={[s.dayNum, s.dayNumOverlay, { color: "#FFFFFF" }]}>{d}</Text>
            {/* the rainbow flame — Ultimate's own file, not a tinted generic */}
            <View style={s.flameOverlay}>
              <Icon name={flame} size={TILE_FLAME_SIZE} mode={TILE_FLAME_MODE} />
            </View>
          </View>
        </Tap>
      );
    }

    return (
      <Tap onPress={() => setDay(d)} style={s.cell}>
        <View style={s.tileWrap}>
          <TravelBorder color={t.color} cardBg={`${t.color}33`} borderColor={T.border} radius={12} strokeWidth={2.5}>
            <View style={s.tileInner} />
          </TravelBorder>
          <Text style={[s.dayNum, s.dayNumOverlay, { color: T.text }]}>{d}</Text>
          {/* each tier burns in its own colour, straight from its own file */}
          <View style={s.flameOverlay}>
            <Icon name={flame} size={TILE_FLAME_SIZE} mode={TILE_FLAME_MODE} />
          </View>
        </View>
      </Tap>
    );
  };

  /* ---------- the day recap ---------- */
  if (day != null) {
    const run = runLengthAt(logged, year, month, day);
    const t = TIERS[tierIndexForRun(run) as 1 | 2 | 3 | 4 | 5];
    const isUlt = !freeLocked && t.color === "ultimate";
    const flame = FLAME_FOR_TIER[t.name] || "flameSpark";
    const total = DAY_MEALS.reduce((sum, m) => sum + m.cal, 0);
    const goal = plan.calories;
    const diff = goal - total;

    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <Pressable onPress={() => setDay(null)} style={s.backRow} hitSlop={10}>
            <ChevronLeft size={22} color={T.text} />
            <Text style={s.backTitle}>{MSHORT[month]} {day}, {year}</Text>
          </Pressable>

          {freeLocked ? (
            <View style={[s.tierPill, { backgroundColor: T.cardHi }]}>
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: T.sub }}>Logged · streak running</Text>
            </View>
          ) : isUlt ? (
            <LinearGradient colors={ULT_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tierPill}>
              <Icon name={flame} size={16} mode="loop" />
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: "#fff" }}>Day {run} · Ultimate</Text>
            </LinearGradient>
          ) : (
            <View style={[s.tierPill, { backgroundColor: `${t.color}22` }]}>
              <Icon name={flame} size={16} mode="loop" />
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: t.color }}>Day {run} · {t.name}</Text>
            </View>
          )}

          {DAY_MEALS.map((m, i) => (
            <View key={i} style={s.mealCard}>
              <View style={s.photo}>
                <Text style={s.photoLabel}>{m.name.toLowerCase()} photo</Text>
                {m.voice && (
                  <View style={s.voiceBadge}>
                    <Mic size={11} color={T.green} />
                    <Text style={s.voiceText}>voice added</Text>
                  </View>
                )}
              </View>
              <View style={{ padding: 15 }}>
                <View style={s.rowBetween}>
                  <View style={s.mealHeadRow}>
                    {/* the meal's own icon, matching Home's meal rows */}
                    <Icon name={m.icon} size={17} mode="loop" />
                    <Micro>{m.name} · {m.time}</Micro>
                  </View>
                  <View style={s.aiTag}>
                    <Sparkles size={10} color={T.green} />
                    <Text style={s.aiText}>MOTION AI</Text>
                  </View>
                </View>
                <Text style={s.mealTitle}>{m.title}</Text>
                <View style={s.rowBetween}>
                  <Text style={s.mealCalBig}>
                    {m.cal} <Text style={s.mealCalUnit}>cal</Text>
                  </Text>
                  <Text style={s.pctText}>{m.pct}% of your day</Text>
                </View>
                <View style={s.pctTrack}>
                  <View style={[s.pctFill, { width: `${m.pct}%` }]} />
                </View>
              </View>
            </View>
          ))}

          <TravelBorder
            {...(isUlt ? { colors: ULT_COLORS } : { color: freeLocked ? T.green : t.color })}
            cardBg={T.card}
            borderColor={T.border}
            radius={18}
          >
            <View style={{ padding: 18 }}>
              <Micro>Day total</Micro>
              <View style={s.totalRow}>
                <Text style={s.totalBig}>{total.toLocaleString()}</Text>
                <Text style={s.totalSub}>of {goal.toLocaleString()} cal</Text>
                <Text style={[s.totalUnder, { color: diff >= 0 ? T.green : T.orange }]}>
                  {Math.abs(diff)} {diff >= 0 ? "under" : "over"}
                </Text>
              </View>
            </View>
          </TravelBorder>
        </ScrollView>
      </View>
    );
  }

  /* ---------- the month grid ---------- */
  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <PageHeader
          title="Calendar"
          right={
            <Tap onPress={openPicker}>
              <View style={s.jumpChip}>
                {/* the same calendar animation the tab bar uses */}
                <Icon name="calendar" size={19} mode="loop" />
              </View>
            </Tap>
          }
        />

        <View style={s.monthRow}>
          <Pressable onPress={prevMonth} hitSlop={12} style={s.monthArrow}>
            <ChevronLeft size={18} color={T.sub} />
          </Pressable>
          <Text style={s.monthText}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={canGoNext ? nextMonth : undefined} hitSlop={12} style={s.monthArrow}>
            <ChevronRight size={18} color={canGoNext ? T.sub : T.border} />
          </Pressable>
        </View>

        {freeLocked ? (
          <>
            <Tap onPress={() => openPaywall("subscribe")}>
              <View style={s.plainBar}>
                <Lock size={13} color={T.green} />
                <Text style={s.plainBarText}>Your streak's still running — unlock tier colours with Pro</Text>
              </View>
            </Tap>
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={{ width: 11, height: 11, borderRadius: 4, backgroundColor: T.green }} />
                <Text style={s.legendText}>Logged · free plan</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.legend}>
            {[1, 2, 3, 4].map((tr) => {
              const tt = TIERS[tr as 1 | 2 | 3 | 4];
              return (
                <View key={tr} style={s.legendItem}>
                  <View style={{ width: 11, height: 11, borderRadius: 4, backgroundColor: tt.color }} />
                  <Text style={s.legendText}>{tt.name}</Text>
                </View>
              );
            })}
            <View style={s.legendItem}>
              <LinearGradient colors={ULT_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 11, height: 11, borderRadius: 4 }} />
              <Text style={s.legendText}>Ultimate</Text>
            </View>
          </View>
        )}

        <View style={s.dowRow}>
          {DOW.map((d, i) => <Text key={i} style={s.dow}>{d}</Text>)}
        </View>

        <View style={s.grid}>
          {cells.map((d, i) => <DayTile key={`${year}-${month}-${i}`} d={d} />)}
        </View>

        <Text style={s.hint}>
          {freeLocked ? "Tap any logged day to open its recap →" : "Tap any lit day to open its recap →"}
        </Text>

        {/* the free-tier countdown — Pro users never see this */}
        {freeLocked && (
          <StreakWarnCard daysLeft={DAYS_LEFT} fadeDate={FADE_DATE} onTap={() => setReelOpen(true)} />
        )}
      </ScrollView>

      <StreakReel visible={reelOpen} onClose={() => setReelOpen(false)} />

      {/* ---------- DATE JUMP ---------- */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)} />
          <View style={s.pickerCentre} pointerEvents="box-none">
            <View style={s.pickerCard}>
              <View style={s.pickerHead}>
                <View style={{ width: 34 }} />
                <Text style={s.pickerTitle}>Jump to</Text>
                <Pressable onPress={() => setPickerOpen(false)} hitSlop={14} style={s.pickerClose}>
                  <X size={17} color={T.sub} />
                </Pressable>
              </View>

              <View style={s.wheelLabels}>
                <Text style={[s.wheelLabel, { flex: 0.8 }]}>Day</Text>
                <Text style={[s.wheelLabel, { flex: 1.3 }]}>Month</Text>
                <Text style={[s.wheelLabel, { flex: 1 }]}>Year</Text>
              </View>

              <View style={s.wheelRow}>
                <View style={s.wheelBand} pointerEvents="none" />
                <View style={{ flex: 0.8, alignItems: "center" }}>
                  <Wheel
                    T={T}
                    width={60}
                    values={Array.from({ length: 31 }, (_, i) => i + 1)}
                    labels={Array.from({ length: 31 }, (_, i) => String(i + 1))}
                    value={pD}
                    onChange={setPD}
                    disabled={dayDisabled}
                  />
                </View>
                <View style={{ flex: 1.3, alignItems: "center" }}>
                  <Wheel
                    T={T}
                    width={120}
                    values={Array.from({ length: 12 }, (_, i) => i)}
                    labels={MONTHS}
                    value={pM}
                    onChange={setPM}
                    disabled={monthDisabled}
                  />
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Wheel
                    T={T}
                    width={80}
                    values={YEARS}
                    labels={YEARS.map(String)}
                    value={pY}
                    onChange={setPY}
                    disabled={yearDisabled}
                  />
                </View>
              </View>

              <View style={s.pickerFooter}>
                <Tap onPress={jumpToday} style={{ flex: 1 }}>
                  <View style={s.pickerGhost}>
                    <Text style={s.pickerGhostText}>Today</Text>
                  </View>
                </Tap>
                <Tap onPress={applyPicker} style={{ flex: 1.5 }}>
                  <View style={s.pickerGo}>
                    <Text style={s.pickerGoText}>
                      Go to {MSHORT[pM]} {Math.min(pD, daysInMonth(pY, pM))}
                    </Text>
                  </View>
                </Tap>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const wheelStyles = (T: any) =>
  StyleSheet.create({
    wheelText: { fontSize: 15, color: T.sub, fontFamily: FONTS.body },
    wheelActive: { fontSize: 18, color: T.green, fontFamily: FONTS.headingMed },
    wheelOff: { color: T.border },
  });

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    jumpChip: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },

    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
    monthArrow: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    monthText: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, minWidth: 140, textAlign: "center" },

    legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },

    plainBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 12 },
    plainBarText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed, flex: 1 },

    dowRow: { flexDirection: "row", marginBottom: 6 },
    dow: { flex: 1, textAlign: "center", fontSize: 10, color: T.micro, fontFamily: FONTS.body },

    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: `${100 / 7}%`, padding: 3 },
    tileBox: { height: TILE_SIZE, borderRadius: 12, overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" },
    tileWrap: { position: "relative" },
    tileInner: { height: TILE_SIZE - 5, borderRadius: 12 },
    dayNum: { fontSize: 12, fontFamily: FONTS.heading },
    dayNumOverlay: { position: "absolute", top: 5, left: 7, zIndex: 2 },
    flameOverlay: { position: "absolute", top: 19, left: 5, zIndex: 2 },
    plainCheck: { position: "absolute", bottom: 5, right: 7, fontSize: 12, color: T.green, fontFamily: FONTS.heading },

    hint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 18 },

    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

    backRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginLeft: -6 },
    backTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginLeft: 2 },
    tierPill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 10, marginBottom: 16 },

    mealCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, overflow: "hidden", marginBottom: 12 },
    mealHeadRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    photo: { height: 140, backgroundColor: "#2E2419", justifyContent: "flex-end", padding: 12 },
    photoLabel: { fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONTS.body },
    voiceBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    voiceText: { fontSize: 9, color: "#fff", fontFamily: FONTS.body },
    aiTag: { flexDirection: "row", alignItems: "center", gap: 4 },
    aiText: { fontSize: 9, color: T.green, fontFamily: FONTS.body },
    mealTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginTop: 6, marginBottom: 10 },
    mealCalBig: { fontSize: 20, color: T.text, fontFamily: FONTS.heading },
    mealCalUnit: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    pctText: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    pctTrack: { marginTop: 8, height: 6, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
    pctFill: { height: "100%", backgroundColor: T.green, borderRadius: 99 },

    totalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
    totalBig: { fontSize: 34, color: T.text, fontFamily: FONTS.heading },
    totalSub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
    totalUnder: { marginLeft: "auto", fontSize: 12, fontFamily: FONTS.headingMed },

    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    pickerCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    pickerCard: { width: "100%", maxWidth: 360, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 22, overflow: "hidden" },
    pickerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    pickerTitle: { flex: 1, textAlign: "center", fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    pickerClose: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },

    wheelLabels: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 4 },
    wheelLabel: { textAlign: "center", fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    wheelRow: { flexDirection: "row", paddingHorizontal: 16, position: "relative" },
    wheelBand: { position: "absolute", left: 16, right: 16, top: ROW_H * 2, height: ROW_H, borderRadius: 10, backgroundColor: T.greenBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.greenBorder, zIndex: 0 },

    pickerFooter: { flexDirection: "row", gap: 8, padding: 16 },
    pickerGhost: { alignItems: "center", paddingVertical: 12, borderRadius: 13, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
    pickerGhostText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
    pickerGo: { alignItems: "center", paddingVertical: 12, borderRadius: 13, backgroundColor: T.green },
    pickerGoText: { fontSize: 13, color: T.ink, fontFamily: FONTS.headingMed },
  });