import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const C = {
  bg: "#0A0A0A",
  card: "#141414",
  cardHi: "#1A1A1A",
  border: "#242424",
  text: "#F5F5F5",
  sub: "#8A8A8A",
  micro: "#6A6A6A",
  green: "#22C55E",
  greenBg: "rgba(34,197,94,0.10)",
  greenBorder: "rgba(34,197,94,0.35)",
  red: "#EF4444",
  redBg: "rgba(239,68,68,0.10)",
  redBorder: "rgba(239,68,68,0.30)",
};

// Sample data. status: "g" under goal, "b" over goal, "cur" today, "n" no data
type Day = {
  date: number;
  cal?: number;
  goal?: number;
  status: "g" | "b" | "cur" | "n";
  meals?: { name: string; cal: number }[];
};

const DAYS: (Day | null)[] = [
  null, null, null,
  { date: 1, cal: 1660, goal: 1980, status: "g", meals: [{ name: "Breakfast", cal: 410 }, { name: "Lunch", cal: 620 }, { name: "Dinner", cal: 630 }] },
  { date: 2, cal: 2140, goal: 1980, status: "b", meals: [{ name: "Breakfast", cal: 520 }, { name: "Lunch", cal: 780 }, { name: "Dinner", cal: 840 }] },
  { date: 3, cal: 1890, goal: 1980, status: "g", meals: [{ name: "Breakfast", cal: 390 }, { name: "Lunch", cal: 700 }, { name: "Dinner", cal: 800 }] },
  { date: 4, status: "n" },
  { date: 5, cal: 1570, goal: 1980, status: "g", meals: [{ name: "Breakfast", cal: 420 }, { name: "Lunch", cal: 610 }, { name: "Dinner", cal: 540 }] },
  { date: 6, cal: 2520, goal: 1980, status: "b", meals: [{ name: "Breakfast", cal: 600 }, { name: "Lunch", cal: 920 }, { name: "Dinner", cal: 1000 }] },
  { date: 7, cal: 2200, goal: 1980, status: "b", meals: [{ name: "Breakfast", cal: 550 }, { name: "Lunch", cal: 800 }, { name: "Dinner", cal: 850 }] },
  { date: 8, cal: 1830, goal: 1980, status: "g", meals: [{ name: "Breakfast", cal: 400 }, { name: "Lunch", cal: 680 }, { name: "Dinner", cal: 750 }] },
  { date: 9, cal: 1340, goal: 1980, status: "cur", meals: [{ name: "Breakfast", cal: 215 }, { name: "Lunch", cal: 530 }, { name: "Dinner", cal: 595 }] },
  { date: 10, status: "n" }, { date: 11, status: "n" }, { date: 12, status: "n" }, { date: 13, status: "n" }, { date: 14, status: "n" },
  { date: 15, status: "n" }, { date: 16, status: "n" }, { date: 17, status: "n" }, { date: 18, status: "n" }, { date: 19, status: "n" }, { date: 20, status: "n" }, { date: 21, status: "n" },
];

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function Calendar() {
  const [selected, setSelected] = useState<Day | null>(
    DAYS.find((d) => d?.status === "cur") ?? null
  );

  const tileStyle = (d: Day) => {
    if (d.status === "g") return { bg: C.greenBg, border: C.greenBorder };
    if (d.status === "b") return { bg: C.redBg, border: C.redBorder };
    if (d.status === "cur") return { bg: C.cardHi, border: C.green };
    return { bg: C.card, border: C.border };
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingTop: 60, paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Calendar</Text>
        <View style={styles.monthNav}>
          <Pressable hitSlop={10}><ChevronLeft size={18} color={C.sub} /></Pressable>
          <Text style={styles.monthText}>Aug 2026</Text>
          <Pressable hitSlop={10}><ChevronRight size={18} color={C.sub} /></Pressable>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.greenBg, borderColor: C.greenBorder }]} />
          <Text style={styles.legendText}>Under goal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.redBg, borderColor: C.redBorder }]} />
          <Text style={styles.legendText}>Over goal</Text>
        </View>
      </View>

      {/* Day-of-week header */}
      <View style={styles.dowRow}>
        {DOW.map((d, i) => (
          <Text key={i} style={styles.dowText}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {DAYS.map((d, i) => {
          if (!d) return <View key={i} style={styles.tileEmpty} />;
          const ts = tileStyle(d);
          const hasData = d.status === "g" || d.status === "b" || d.status === "cur";
          const valColor = d.status === "b" ? C.red : C.green;
          return (
            <Pressable
              key={i}
              onPress={() => hasData && setSelected(d)}
              style={[styles.tile, { backgroundColor: ts.bg, borderColor: ts.border }]}
            >
              <Text style={[styles.tileDate, d.status === "cur" && { color: C.green }]}>{d.date}</Text>
              {hasData && d.cal && (
                <Text style={[styles.tileCal, { color: valColor }]}>{d.cal}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Selected day breakdown */}
      {selected && selected.meals && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailLabel}>
              AUG {selected.date} · {selected.status === "b" ? "OVER GOAL" : "UNDER GOAL"}
            </Text>
            <Text style={[styles.detailTotal, { color: selected.status === "b" ? C.red : C.green }]}>
              {selected.cal} / {selected.goal}
            </Text>
          </View>
          {selected.meals.map((m, i) => (
            <View key={i} style={[styles.mealRow, i > 0 && styles.mealRowBorder]}>
              <Text style={styles.mealName}>{m.name}</Text>
              <Text style={styles.mealCal}>{m.cal} kcal</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  h1: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: C.text, letterSpacing: -0.5 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 12 },
  monthText: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 14, color: C.text },
  legend: { flexDirection: "row", gap: 18, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.sub },
  dowRow: { flexDirection: "row", marginBottom: 8 },
  dowText: { flex: 1, textAlign: "center", fontFamily: "Inter_500Medium", fontSize: 10, color: C.micro },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { width: `${100 / 7}%`, aspectRatio: 1, borderWidth: 1, borderRadius: 12, padding: 6, justifyContent: "space-between", marginBottom: 6 },
  tileEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  tileDate: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 12, color: C.text },
  tileCal: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 10 },
  detailCard: { marginTop: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 18 },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  detailLabel: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1, color: C.micro },
  detailTotal: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 13 },
  mealRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  mealRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  mealName: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  mealCal: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 13, color: C.sub },
});