import { Bell, ChevronRight, CircleHelp, Crown, LogOut, Target, Utensils } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

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

function Row({ icon, label, value, onPress, isLast }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>{icon}</View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <ChevronRight size={18} color={C.micro} />
      </View>
    </Pressable>
  );
}

export default function Profile() {
  const [notifications, setNotifications] = useState(true);
  const [waterReminders, setWaterReminders] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={styles.h1}>Profile</Text>

      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>DJ</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Dion</Text>
          <Text style={styles.email}>dion@example.com</Text>
        </View>
        <Pressable style={styles.editBtn}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      {/* Subscription card */}
      <View style={styles.proCard}>
        <View style={styles.proHeader}>
          <Crown size={18} color={C.green} />
          <Text style={styles.proTitle}>Free Plan</Text>
        </View>
        <Text style={styles.proSub}>Upgrade to unlock unlimited photo logging, barcode scanning, and detailed insights.</Text>
        <Pressable style={styles.proBtn}>
          <Text style={styles.proBtnText}>Upgrade to Pro</Text>
        </Pressable>
      </View>

      {/* Goals section */}
      <Text style={styles.sectionLabel}>GOALS</Text>
      <View style={styles.section}>
        <Row icon={<Target size={18} color={C.green} />} label="Daily calorie goal" value="1,980" isLast={false} />
        <Row icon={<Utensils size={18} color={C.green} />} label="Macro targets" value="P/C/F" isLast={true} />
      </View>

      {/* Preferences section */}
      <Text style={styles.sectionLabel}>PREFERENCES</Text>
      <View style={styles.section}>
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Bell size={18} color={C.green} /></View>
            <Text style={styles.rowLabel}>Meal reminders</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: "#2A2A2A", true: C.green }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Bell size={18} color={C.green} /></View>
            <Text style={styles.rowLabel}>Water reminders</Text>
          </View>
          <Switch
            value={waterReminders}
            onValueChange={setWaterReminders}
            trackColor={{ false: "#2A2A2A", true: C.green }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Account section */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.section}>
        <Row icon={<CircleHelp size={18} color={C.green} />} label="Help & support" isLast={false} />
        <Row icon={<LogOut size={18} color={C.green} />} label="Log out" isLast={true} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: C.text, letterSpacing: -0.5, marginBottom: 18 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, color: C.green },
  name: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, color: C.text },
  email: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.sub, marginTop: 2 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  editText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  proCard: { marginTop: 12, backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 18, padding: 18 },
  proHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  proTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, color: C.text },
  proSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.sub, lineHeight: 19, marginBottom: 14 },
  proBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  proBtnText: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14, color: "#0A0A0A" },
  sectionLabel: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1, color: C.micro, marginTop: 24, marginBottom: 10 },
  section: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: { width: 22, alignItems: "center" },
  rowLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 13, color: C.sub },
});