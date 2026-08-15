// app/(tabs)/calendar.tsx
import { LinearGradient } from "expo-linear-gradient";
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Lock, Mic, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;
const ULT_COLORS: [string, string, ...string[]] = ["#F43F5E", "#F97316", "#FACC15", "#22C55E", "#3B82F6", "#8B5CF6"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TIERS: Record<number, { name: string; color: string }> = {
  1: { name: "Spark", color: "#38BDF8" },
  2: { name: "Warming", color: "#FBBF24" },
  3: { name: "Hot", color: "#FB923C" },
  4: { name: "Red-hot", color: "#EF4444" },
  5: { name: "Ultimate", color: "ultimate" },
};
const TODAY = 18;
function dayTier(d: number | null): number {
  if (d == null || d > TODAY) return 0;
  if (d <= 4) return 1;
  if (d <= 8) return 2;
  if (d <= 12) return 3;
  if (d <= 16) return 4;
  return 5;
}
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const CELLS: (number | null)[] = [null, null, null, ...Array.from({ length: 25 }, (_, i) => i + 1)];

const DAY_MEALS = [
  { name: "Breakfast", time: "8:15 AM", title: "Scrambled eggs & avocado", cal: 430, pct: 22, voice: true },
  { name: "Lunch", time: "12:41 PM", title: "Grilled chicken & rice", cal: 620, pct: 31, voice: false },
  { name: "Dinner", time: "7:20 PM", title: "Salmon, greens & potato", cal: 700, pct: 35, voice: true },
];

const TILE_SIZE = 52;

function Micro({ children }: { children: React.ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

// `plain` = free user: no tier colours, just a green check on logged days
function DayTile({ d, onSelect, plain }: { d: number | null; onSelect: (d: number) => void; plain: boolean }) {
  if (d == null) return <View style={styles.cell} />;
  const tier = dayTier(d);
  const t = TIERS[tier];
  const happened = d <= TODAY;
  const isUlt = t && t.color === "ultimate";

  // future / not-happened day — plain dark tile with number
  if (!happened) {
    return (
      <View style={styles.cell}>
        <View style={[styles.tileBox, { backgroundColor: T.emptyTile, borderWidth: 1, borderColor: T.border }]}>
          <Text style={[styles.dayNum, { color: T.micro }]}>{d}</Text>
        </View>
      </View>
    );
  }

  // FREE user — plain logged tile: green check, no tier colour
  if (plain) {
    return (
      <Pressable style={styles.cell} onPress={() => onSelect(d)}>
        <View style={[styles.tileBox, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}>
          <Text style={[styles.dayNum, styles.dayNumOverlay, { color: T.text }]}>{d}</Text>
          <Text style={styles.plainCheck}>✓</Text>
        </View>
      </Pressable>
    );
  }

  // ULTIMATE — filled purple tile, revolving rainbow border, warm flame
  if (isUlt) {
    return (
      <Pressable style={styles.cell} onPress={() => onSelect(d)}>
        <View style={styles.tileWrap}>
          <TravelBorder colors={ULT_COLORS} cardBg="#3B1A4A" borderColor={T.border} radius={12} strokeWidth={2.5}>
            <View style={styles.tileInner} />
          </TravelBorder>
          <Text style={[styles.dayNum, styles.dayNumOverlay, { color: "#FFFFFF" }]}>{d}</Text>
          <Flame size={12} color="#FACC15" fill="#FB923C" style={styles.flameOverlay} />
        </View>
      </Pressable>
    );
  }

  // normal tiers — filled tinted tile (via cardBg), single-color revolving border
  return (
    <Pressable style={styles.cell} onPress={() => onSelect(d)}>
      <View style={styles.tileWrap}>
        <TravelBorder color={t.color} cardBg={`${t.color}33`} borderColor={T.border} radius={12} strokeWidth={2.5}>
          <View style={styles.tileInner} />
        </TravelBorder>
        <Text style={[styles.dayNum, styles.dayNumOverlay, { color: T.text }]}>{d}</Text>
        <Flame size={12} color={t.color} fill={t.color} style={styles.flameOverlay} />
      </View>
    </Pressable>
  );
}

export default function Calendar() {
  const { freeLocked, openPaywall } = useApp();
  const [day, setDay] = useState<number | null>(null);
  const [monthIdx, setMonthIdx] = useState(7); // 7 = August
  const [year, setYear] = useState(2026);

  const prevMonth = () => {
    if (monthIdx === 0) { setMonthIdx(11); setYear((y) => y - 1); }
    else setMonthIdx((m) => m - 1);
  };
  const nextMonth = () => {
    if (monthIdx === 11) { setMonthIdx(0); setYear((y) => y + 1); }
    else setMonthIdx((m) => m + 1);
  };

  if (day != null) {
    const tier = dayTier(day);
    const t = TIERS[tier];
    const isUlt = !freeLocked && t.color === "ultimate";
    const total = DAY_MEALS.reduce((s, m) => s + m.cal, 0);
    const goal = 1980;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <Pressable onPress={() => setDay(null)} style={styles.backRow}>
            <ChevronLeft size={22} color={T.text} />
            <Text style={styles.backTitle}>{MONTHS[monthIdx].slice(0, 3)} {day}, {year}</Text>
          </Pressable>

          {freeLocked ? (
            <View style={[styles.tierPill, { backgroundColor: T.cardHi }]}>
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: T.sub }}>Logged · streak running</Text>
            </View>
          ) : isUlt ? (
            <LinearGradient colors={ULT_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tierPill}>
              <Flame size={12} color="#fff" fill="#fff" />
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: "#fff" }}>Ultimate streak day</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.tierPill, { backgroundColor: `${t.color}22` }]}>
              <Flame size={12} color={t.color} fill={t.color} />
              <Text style={{ fontSize: 11, fontFamily: FONTS.headingMed, color: t.color }}>{t.name} streak day</Text>
            </View>
          )}

          {DAY_MEALS.map((m, i) => (
            <View key={i} style={styles.mealCard}>
              <View style={styles.photo}>
                <Text style={styles.photoLabel}>{m.name.toLowerCase()} photo</Text>
                {m.voice && (
                  <View style={styles.voiceBadge}>
                    <Mic size={11} color={T.green} />
                    <Text style={styles.voiceText}>voice added</Text>
                  </View>
                )}
              </View>
              <View style={{ padding: 15 }}>
                <View style={styles.rowBetween}>
                  <Micro>{m.name} · {m.time}</Micro>
                  <View style={styles.aiTag}>
                    <Sparkles size={10} color={T.green} />
                    <Text style={styles.aiText}>AI</Text>
                  </View>
                </View>
                <Text style={styles.mealTitle}>{m.title}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.mealCalBig}>
                    {m.cal} <Text style={styles.mealCalUnit}>cal</Text>
                  </Text>
                  <Text style={styles.pctText}>{m.pct}% of your day</Text>
                </View>
                <View style={styles.pctTrack}>
                  <View style={[styles.pctFill, { width: `${m.pct}%` }]} />
                </View>
              </View>
            </View>
          ))}

          {isUlt ? (
            <TravelBorder colors={ULT_COLORS} cardBg={T.card} borderColor={T.border} radius={18}>
              <View style={{ padding: 18 }}>
                <Micro>Day total</Micro>
                <View style={styles.totalRow}>
                  <Text style={styles.totalBig}>{total.toLocaleString()}</Text>
                  <Text style={styles.totalSub}>of {goal.toLocaleString()} cal</Text>
                  <Text style={styles.totalUnder}>{goal - total} under</Text>
                </View>
              </View>
            </TravelBorder>
          ) : (
            <TravelBorder color={freeLocked ? T.green : t.color} cardBg={T.card} borderColor={T.border} radius={18}>
              <View style={{ padding: 18 }}>
                <Micro>Day total</Micro>
                <View style={styles.totalRow}>
                  <Text style={styles.totalBig}>{total.toLocaleString()}</Text>
                  <Text style={styles.totalSub}>of {goal.toLocaleString()} cal</Text>
                  <Text style={styles.totalUnder}>{goal - total} under</Text>
                </View>
              </View>
            </TravelBorder>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Calendar</Text>
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} hitSlop={10}><ChevronLeft size={17} color={T.sub} /></Pressable>
            <Text style={styles.monthText}>{MONTHS[monthIdx].slice(0, 3)} {year}</Text>
            <Pressable onPress={nextMonth} hitSlop={10}><ChevronRight size={17} color={T.sub} /></Pressable>
            <Pressable hitSlop={10} style={{ marginLeft: 4 }}><CalendarDays size={17} color={T.green} /></Pressable>
          </View>
        </View>

        {/* FREE users see a "colours are Pro" bar instead of the tier legend */}
        {freeLocked ? (
          <Pressable onPress={() => openPaywall("subscribe")} style={styles.plainBar}>
            <Lock size={13} color={T.green} />
            <Text style={styles.plainBarText}>Your streak's still running — unlock tier colours with Pro</Text>
          </Pressable>
        ) : (
          <View style={styles.legend}>
            {[1, 2, 3, 4].map((tr) => {
              const tt = TIERS[tr];
              return (
                <View key={tr} style={styles.legendItem}>
                  <View style={{ width: 11, height: 11, borderRadius: 4, backgroundColor: tt.color }} />
                  <Text style={styles.legendText}>{tt.name}</Text>
                </View>
              );
            })}
            <View style={styles.legendItem}>
              <LinearGradient colors={ULT_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 11, height: 11, borderRadius: 4 }} />
              <Text style={styles.legendText}>Ultimate</Text>
            </View>
          </View>
        )}

        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text key={i} style={styles.dow}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {CELLS.map((d, i) => (
            <DayTile key={i} d={d} onSelect={setDay} plain={freeLocked} />
          ))}
        </View>

        <Text style={styles.hint}>
          {freeLocked ? "Tap any logged day to open its recap →" : "Tap any lit day to open its recap →"}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  h1: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  monthText: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },

  plainBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${T.green}14`, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 16 },
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
  flameOverlay: { position: "absolute", top: 20, left: 6, zIndex: 2 },
  plainCheck: { position: "absolute", bottom: 5, right: 7, fontSize: 12, color: T.green, fontFamily: FONTS.heading },

  hint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 18 },

  micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginLeft: -6 },
  backTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginLeft: 2 },
  tierPill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 10, marginBottom: 16 },

  mealCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, overflow: "hidden", marginBottom: 12 },
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
  totalUnder: { marginLeft: "auto", fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
});