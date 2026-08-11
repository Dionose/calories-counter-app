// app/(tabs)/calendar.tsx
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Flame, Mic, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;
const ULT_COLORS = ["#F43F5E", "#F97316", "#FACC15", "#22C55E", "#3B82F6", "#A855F7"];

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

const TILE_SIZE = 46; // fixed height so every tile is the same big size

function Micro({ children }: { children: React.ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

function DayTile({ d, onSelect }: { d: number | null; onSelect: (d: number) => void }) {
  if (d == null) return <View style={styles.cell} />;
  const tier = dayTier(d);
  const t = TIERS[tier];
  const happened = d <= TODAY;
  const isUlt = t && t.color === "ultimate";

  // future / not-happened day — fills the whole cell (this is the big size we want)
  if (!happened) {
    return (
      <View style={styles.cell}>
        <View style={[styles.tileFull, { backgroundColor: T.emptyTile, borderWidth: 1, borderColor: T.border }]}>
          <Text style={{ fontSize: 12, fontFamily: FONTS.heading, color: T.micro }}>{d}</Text>
        </View>
      </View>
    );
  }

  const innerContent = (dayColor: string, flameColor: string) => (
    <View style={styles.tileInner}>
      <Text style={{ fontSize: 12, fontFamily: FONTS.heading, color: dayColor }}>{d}</Text>
      <Flame size={10} color={flameColor} fill={flameColor} />
    </View>
  );

  // ULTIMATE — revolving rainbow border
  if (isUlt) {
    return (
      <Pressable style={styles.cell} onPress={() => onSelect(d)}>
        <TravelBorder colors={ULT_COLORS} cardBg="#1A0F22" borderColor={T.border} radius={12} strokeWidth={2.5} style={styles.tileFull}>
          {innerContent("#FFFFFF", "#FFFFFF")}
        </TravelBorder>
      </Pressable>
    );
  }

  // normal tiers — single-color revolving border
  return (
    <Pressable style={styles.cell} onPress={() => onSelect(d)}>
      <TravelBorder color={t.color} cardBg={`${t.color}22`} borderColor={T.border} radius={12} strokeWidth={2.5} style={styles.tileFull}>
        {innerContent(T.text, t.color)}
      </TravelBorder>
    </Pressable>
  );
}

export default function Calendar() {
  const [day, setDay] = useState<number | null>(null);

  if (day != null) {
    const tier = dayTier(day);
    const t = TIERS[tier];
    const isUlt = t.color === "ultimate";
    const total = DAY_MEALS.reduce((s, m) => s + m.cal, 0);
    const goal = 1980;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
          <Pressable onPress={() => setDay(null)} style={styles.backRow}>
            <ChevronLeft size={22} color={T.text} />
            <Text style={styles.backTitle}>Aug {day}, 2026</Text>
          </Pressable>

          {isUlt ? (
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
            <TravelBorder color={t.color} cardBg={T.card} borderColor={T.border} radius={18}>
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
            <ChevronLeft size={17} color={T.sub} />
            <Text style={styles.monthText}>Aug 2026</Text>
            <ChevronRight size={17} color={T.sub} />
          </View>
        </View>

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

        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text key={i} style={styles.dow}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {CELLS.map((d, i) => (
            <DayTile key={i} d={d} onSelect={setDay} />
          ))}
        </View>

        <Text style={styles.hint}>Tap any lit day to open its recap →</Text>
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

  dowRow: { flexDirection: "row", marginBottom: 6 },
  dow: { flex: 1, textAlign: "center", fontSize: 10, color: T.micro, fontFamily: FONTS.body },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, padding: 3 },
  tileFull: { height: TILE_SIZE, borderRadius: 12 },
  tileInner: { flex: 1, borderRadius: 10, padding: 5, justifyContent: "space-between", alignItems: "flex-start" },

  hint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 18 },

  micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginLeft: -6 },
  backTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginLeft: 2 },
  tierPill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, marginBottom: 16 },

  mealCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, overflow: "hidden", marginBottom: 14 },
  photo: { height: 140, backgroundColor: "#2E2419", justifyContent: "flex-end", padding: 12 },
  photoLabel: { fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: FONTS.body },
  voiceBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 99, paddingVertical: 4, paddingHorizontal: 8 },
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