import { Camera, ChevronRight, ScanBarcode, Search } from "lucide-react-native";
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
};

const options = [
  {
    icon: Camera,
    title: "Snap a meal",
    desc: "Take a photo and let AI estimate the calories and macros.",
    tag: "AI",
  },
  {
    icon: ScanBarcode,
    title: "Scan barcode",
    desc: "Scan a packaged food for exact nutrition facts.",
    tag: "Exact",
  },
  {
    icon: Search,
    title: "Search food",
    desc: "Type to find a food from the database and log it.",
    tag: "Exact",
  },
];

export default function CameraHub() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={styles.h1}>Log food</Text>
      <Text style={styles.subtitle}>Choose how you want to add your meal.</Text>

      <View style={styles.optionList}>
        {options.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <Pressable key={i} style={styles.optionCard}>
              <View style={styles.iconBox}>
                <Icon size={24} color={C.green} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{opt.tag}</Text>
                  </View>
                </View>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              <ChevronRight size={20} color={C.micro} />
            </Pressable>
          );
        })}
      </View>

      {/* Recent quick-add */}
      <Text style={styles.sectionLabel}>QUICK ADD RECENT</Text>
      <View style={styles.recentCard}>
        {[["Grilled chicken bowl", "530"], ["Greek yogurt, berries", "210"], ["Black coffee", "5"]].map((r, i) => (
          <Pressable key={i} style={[styles.recentRow, i > 0 && styles.recentBorder]}>
            <Text style={styles.recentName}>{r[0]}</Text>
            <View style={styles.recentRight}>
              <Text style={styles.recentCal}>{r[1]}</Text>
              <View style={styles.plusBtn}>
                <Text style={styles.plusText}>+</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: C.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.sub, marginTop: 4, marginBottom: 22 },
  optionList: { gap: 12 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBorder, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, color: C.text },
  tag: { backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 0.5, color: C.sub },
  optionDesc: { fontFamily: "Inter_400Regular", fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 18 },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1, color: C.micro, marginTop: 28, marginBottom: 10 },
  recentCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" },
  recentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15 },
  recentBorder: { borderTopWidth: 1, borderTopColor: C.border },
  recentName: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text, flex: 1 },
  recentRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  recentCal: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 13, color: C.sub },
  plusBtn: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBorder, alignItems: "center", justifyContent: "center" },
  plusText: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, color: C.green, marginTop: -2 },
});