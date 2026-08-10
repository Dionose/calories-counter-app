import { TrendingDown } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const C = {
  bg: "#0A0A0A",
  card: "#141414",
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

const summary = [
  { label: "AVG / DAY", value: "1,720", unit: "kcal", accent: false },
  { label: "GOAL STREAK", value: "4", unit: "days", accent: false },
  { label: "BEST DAY", value: "1,340", unit: "kcal", accent: false },
  { label: "THIS WEEK", value: "-6%", unit: "vs last", accent: true },
];

const week = [
  { day: "M", cal: 1720 },
  { day: "T", cal: 1980 },
  { day: "W", cal: 1450 },
  { day: "T", cal: 2100 },
  { day: "F", cal: 1570 },
  { day: "S", cal: 1880 },
  { day: "S", cal: 1340 },
];

const GOAL = 1980;
const MAX = 2200;
const CHART_HEIGHT = 130;

export default function Stats() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={styles.h1}>Stats</Text>

      {/* Summary cards */}
      <View style={styles.cardGrid}>
        {summary.map((s, i) => (
          <View key={i} style={styles.summaryCard}>
            <Text style={styles.microLabel}>{s.label}</Text>
            <Text style={[styles.summaryValue, s.accent && { color: C.green }]}>{s.value}</Text>
            <Text style={styles.summaryUnit}>{s.unit}</Text>
          </View>
        ))}
      </View>

      {/* Weekly chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.microLabel}>LAST 7 DAYS</Text>
          <View style={styles.trendRow}>
            <TrendingDown size={13} color={C.green} />
            <Text style={styles.trendText}>trending down</Text>
          </View>
        </View>

        <View style={styles.chartArea}>
          {/* Goal line */}
          <View style={[styles.goalLine, { bottom: (GOAL / MAX) * CHART_HEIGHT }]} />
          {week.map((d, i) => {
            const over = d.cal > GOAL;
            return (
              <View key={i} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: (d.cal / MAX) * CHART_HEIGHT,
                      backgroundColor: over ? C.redBg : C.greenBg,
                      borderColor: over ? C.redBorder : C.greenBorder,
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{d.day}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: C.text, letterSpacing: -0.5, marginBottom: 18 },
  microLabel: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1, color: C.micro },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  summaryCard: { width: "47.5%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  summaryValue: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: C.text, marginTop: 8, letterSpacing: -0.5 },
  summaryUnit: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.sub, marginTop: 2 },
  chartCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 18 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  trendText: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 11, color: C.green },
  chartArea: { height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", position: "relative" },
  goalLine: { position: "absolute", left: 0, right: 0, height: 1, borderTopWidth: 1, borderTopColor: C.border, borderStyle: "dashed" },
  barColumn: { alignItems: "center", flex: 1, justifyContent: "flex-end", height: CHART_HEIGHT },
  bar: { width: 20, borderRadius: 6, borderWidth: 1 },
  barLabel: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 10, color: C.micro, marginTop: 6 },
});