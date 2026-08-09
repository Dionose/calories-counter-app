import { ScrollView, StyleSheet, Text, View } from "react-native";

const C = {
  bg: "#0A0A0A",
  card: "#141414",
  border: "#242424",
  text: "#F5F5F5",
  sub: "#8A8A8A",
  micro: "#6A6A6A",
  green: "#22C55E",
};

const macros = [
  { label: "Protein", value: "34g", target: "120g" },
  { label: "Carbs", value: "58g", target: "230g" },
  { label: "Fat", value: "18g", target: "65g" },
];

const logged = [
  { name: "Grilled chicken bowl", meta: "Lunch · 12:41", cal: "530" },
  { name: "Greek yogurt, berries", meta: "Breakfast · 8:15", cal: "210" },
  { name: "Black coffee", meta: "Breakfast · 7:02", cal: "5" },
];

export default function Home() {
  const eaten = 1340;
  const goal = 1980;
  const pct = Math.min(100, (eaten / goal) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingTop: 60, paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.microLabel}>TUESDAY · AUG 9</Text>
          <Text style={styles.h1}>Today</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>DJ</Text>
        </View>
      </View>

      {/* Calorie card */}
      <View style={styles.bigCard}>
        <View style={styles.spaceBetween}>
          <Text style={styles.microLabel}>CALORIES EATEN</Text>
          <Text style={styles.greenSmall}>{goal - eaten} left</Text>
        </View>
        <View style={styles.calorieRow}>
          <Text style={styles.bigNumber}>{eaten.toLocaleString()}</Text>
          <Text style={styles.ofGoal}>/ {goal.toLocaleString()}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </View>

      {/* Macros */}
      <View style={styles.macroRow}>
        {macros.map((m) => (
          <View key={m.label} style={styles.macroCard}>
            <Text style={styles.microLabel}>{m.label.toUpperCase()}</Text>
            <Text style={styles.macroValue}>{m.value}</Text>
            <Text style={styles.macroTarget}>of {m.target}</Text>
          </View>
        ))}
      </View>

      {/* Logged today */}
      <View style={[styles.spaceBetween, { marginTop: 24, marginBottom: 10 }]}>
        <Text style={styles.microLabel}>LOGGED TODAY</Text>
        <Text style={styles.microLabel}>3 ITEMS</Text>
      </View>
      <View style={styles.listCard}>
        {logged.map((item, i) => (
          <View key={i} style={[styles.logRow, i > 0 && styles.logRowBorder]}>
            <View>
              <Text style={styles.logName}>{item.name}</Text>
              <Text style={styles.logMeta}>{item.meta}</Text>
            </View>
            <Text style={styles.logCal}>{item.cal}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  h1: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 28, color: C.text, marginTop: 3, letterSpacing: -0.5 },
  microLabel: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1.2, color: C.micro },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 13, color: C.sub },
  bigCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 22 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greenSmall: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 12, color: C.green },
  calorieRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  bigNumber: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 44, color: C.text, letterSpacing: -1 },
  ofGoal: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.sub, marginLeft: 8, marginBottom: 8 },
  progressTrack: { marginTop: 16, height: 8, borderRadius: 99, backgroundColor: "#0E0E0E", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.green, borderRadius: 99 },
  macroRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  macroCard: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
  macroValue: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, color: C.text, marginTop: 8 },
  macroTarget: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.sub, marginTop: 2 },
  listCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" },
  logRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15 },
  logRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  logName: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  logMeta: { fontFamily: "Inter_400Regular", fontSize: 10.5, color: C.micro, marginTop: 3 },
  logCal: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 13, color: C.green },
});