// app/(tabs)/profile.tsx
import { Bell, Check, ChevronRight, Crown, Flame, Lock, LogOut, Mic, Moon, Palette, ScanBarcode, Shield, Sun, Target, User, Vibrate, Watch, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { DARK, FONTS, tierForStreak } from "../../constants/theme";

const T = DARK;
const STREAK_DAYS = 14;

// ---- three-plan paywall data ----
const PLANS = [
  { id: "monthly", name: "Monthly", price: "$9.99", per: "/mo", sub: "Billed monthly", badge: null as string | null, glow: "#FB923C" },
  { id: "yearly", name: "Yearly", price: "$99.99", per: "/yr", sub: "Save ~17% vs monthly", badge: "Popular", glow: "#FBBF24" },
  { id: "lifetime", name: "Lifetime", price: "$499.99", per: "once", sub: "Pay once — yours for life", badge: "Best value", glow: "#FDE68A" },
];

function Micro({ children }: { children: React.ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, { backgroundColor: on ? T.green : T.cardHi, borderColor: on ? T.green : T.border }]}>
      <View style={[styles.knob, { left: on ? 19 : 2 }]} />
    </Pressable>
  );
}

function Row({ icon: Icon, label, value, danger, toggle, toggled, onToggle, onPress, locked }: any) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? "rgba(239,68,68,0.1)" : T.greenBg }]}>
        <Icon size={17} color={danger ? "#EF4444" : T.green} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? "#EF4444" : T.text }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {locked ? <Crown size={16} color="#FBBF24" />
        : toggle ? <Toggle on={toggled} onPress={onToggle} />
        : <ChevronRight size={17} color={T.micro} />}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ marginLeft: 4, marginBottom: 8 }}><Micro>{title}</Micro></View>
      <View style={styles.sectionCard}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.divider} />}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

function ThemeOption({ mode, Icon, label, active, previewBg, previewCard, previewText, accent, onPick }: any) {
  return (
    <Pressable style={{ flex: 1 }} onPress={() => onPick(mode)}>
      <View style={[styles.previewOuter, { backgroundColor: active ? T.green : T.border }]}>
        <View style={[styles.previewInner, { backgroundColor: previewBg }]}>
          <View style={styles.previewTop}>
            <Icon size={18} color={accent} />
            {active && <View style={styles.previewCheck}><Check size={12} color="#fff" /></View>}
          </View>
          <View>
            <View style={{ height: 8, width: "70%", borderRadius: 4, backgroundColor: previewCard, marginBottom: 6 }} />
            <View style={{ height: 8, width: "45%", borderRadius: 4, backgroundColor: accent }} />
          </View>
          <View style={[styles.previewChip, { backgroundColor: previewCard }]}>
            <Text style={{ fontSize: 11, color: previewText, fontFamily: FONTS.heading }}>1,235 cal</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.previewLabel, { color: active ? T.green : T.text }]}>{label}</Text>
    </Pressable>
  );
}

// ---- the three-plan paywall ----
function Paywall({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState("yearly");
  const P = PLANS.find((p) => p.id === plan)!;
  const cta = plan === "lifetime" ? "Get Lifetime — $499.99" : `Subscribe · ${P.price}${P.per}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pwOverlay}>
        <View style={styles.pwCard}>
          <View style={styles.pwHeader}>
            <View style={styles.pwCrown}><Crown size={22} color="#FBBF24" /></View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.pwClose}><X size={18} color={T.sub} /></Pressable>
          </View>
          <Text style={styles.pwTitle}>Unlock MOTION Pro</Text>
          <Text style={styles.pwSub}>Voice AI · barcode · leaderboard · full history · tier colours & more.</Text>

          <Text style={[styles.micro, { marginTop: 16, marginBottom: 10 }]}>Choose your plan</Text>
          {PLANS.map((pl) => {
            const on = plan === pl.id;
            return (
              <Pressable key={pl.id} onPress={() => setPlan(pl.id)} style={[styles.planRow, { borderColor: on ? T.green : T.border, backgroundColor: on ? T.greenBg : T.card }]}>
                <View style={[styles.planCrown, { backgroundColor: pl.glow }]}><Crown size={16} color="#0A0A0A" /></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowCenter}>
                    <Text style={styles.planName}>Pro · {pl.name}</Text>
                    {pl.badge && <View style={styles.planBadge}><Text style={styles.planBadgeText}>{pl.badge}</Text></View>}
                  </View>
                  <Text style={styles.planSub}>{pl.sub}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.planPrice}>{pl.price}</Text>
                  <Text style={styles.planPer}>{pl.per}</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.pwNote}>
            <Shield size={13} color={T.green} />
            <Text style={styles.pwNoteText}>All plans unlock the same Pro — cancel monthly/yearly anytime; lifetime is a one-time payment.</Text>
          </View>

          <Pressable onPress={onClose} style={styles.pwCta}><Text style={styles.pwCtaText}>{cta}</Text></Pressable>
          <Pressable onPress={onClose} style={{ alignItems: "center", marginTop: 12 }}>
            <Text style={styles.pwMaybe}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---- username Pro-gate wall ----
function UsernameGate({ back, onUpgrade }: { back: () => void; onUpgrade: () => void }) {
  return (
    <View style={{ padding: 24, paddingTop: 60, flex: 1, alignItems: "center", justifyContent: "center" }}>
      <View style={styles.gateBadge}><Lock size={26} color="#0A0A0A" /></View>
      <Text style={styles.gateTitle}>Go Pro to change your username</Text>
      <Text style={styles.gateSub}>Changing your username is a Pro feature. Upgrade to Pro to edit it anytime.</Text>
      <Pressable onPress={onUpgrade} style={styles.gateCta}><Text style={styles.gateCtaText}>Upgrade to Pro</Text></Pressable>
      <Pressable onPress={back} style={{ marginTop: 14 }}><Text style={styles.gateMaybe}>Maybe later</Text></Pressable>
    </View>
  );
}

export default function Profile() {
  const { freeLocked, openPaywall, paywallOpen, closePaywall, themeMode, setThemeMode } = useApp();
  const [picker, setPicker] = useState(false);
  const [watch, setWatch] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [sub, setSub] = useState<"main" | "username">("main");

  const tier = tierForStreak(STREAK_DAYS);
  const flameColor = tier.color === "ultimate" ? "#FB923C" : tier.color;

  if (sub === "username") {
    return <UsernameGate back={() => setSub("main")} onUpgrade={() => { setSub("main"); openPaywall("subscribe"); }} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Profile</Text>

        {/* header card */}
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={styles.headerCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>DJ</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Dion</Text>
              <View style={[styles.rowCenter, { marginTop: 3 }]}>
                <Flame size={12} color={flameColor} fill={flameColor} />
                <Text style={styles.streakText}>{STREAK_DAYS}-day streak · {tier.name}</Text>
              </View>
            </View>
          </View>
        </TravelBorder>

        {/* Pro card — opens the three-plan paywall */}
        <Pressable style={{ marginTop: 12, marginBottom: 20 }} onPress={() => openPaywall("subscribe")}>
          <TravelBorder color="#FB923C" cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={styles.proCard}>
              <View style={styles.proIcon}><Crown size={22} color="#FB923C" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.proTitle}>{freeLocked ? "Upgrade to Pro" : "MOTION Pro · active"}</Text>
                <View style={styles.proSubRow}>
                  <Text style={styles.proSub}>Voice AI</Text>
                  <Mic size={12} color={T.sub} />
                  <Text style={styles.proSub}>· barcode</Text>
                  <ScanBarcode size={12} color={T.sub} />
                  <Text style={styles.proSub}>& more</Text>
                </View>
              </View>
              <ChevronRight size={18} color={T.micro} />
            </View>
          </TravelBorder>
        </Pressable>

        <Section title="Appearance">
          <Row icon={Palette} label="Theme" value={themeMode === "dark" ? "Dark" : "Light"} onPress={() => setPicker(true)} />
        </Section>

        <Section title="Devices">
          <Row icon={Watch} label="Connect watch & health" toggle toggled={watch} onToggle={() => setWatch(!watch)} />
        </Section>

        <Section title="Goals">
          <Row icon={Target} label="Goal" value="Lose weight" />
          <Row icon={Target} label="Daily calories" value="1,980 cal" />
          <Row icon={Target} label="Target weight" value="72 kg" />
          <Row icon={Target} label="Units" value="kg / cm" />
        </Section>

        <Section title="Account">
          <Row icon={User} label="Username" locked={freeLocked} onPress={() => (freeLocked ? setSub("username") : null)} />
          <Row icon={User} label="Personal info" />
          <Row icon={Lock} label="Password" />
          <Row icon={Bell} label="Reminders" toggle toggled={reminders} onToggle={() => setReminders(!reminders)} />
          <Row icon={Vibrate} label="Haptics" toggle toggled={haptics} onToggle={() => setHaptics(!haptics)} />
          <Row icon={Shield} label="Privacy" />
          <Row icon={LogOut} label="Log out" danger />
        </Section>
      </ScrollView>

      {/* THEME PICKER POPUP */}
      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setPicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose your theme</Text>
              <Pressable onPress={() => setPicker(false)} style={styles.pickerClose}><X size={15} color={T.sub} /></Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <ThemeOption mode="dark" Icon={Moon} label="Dark" active={themeMode === "dark"}
                previewBg="#0A0A0A" previewCard="#242424" previewText="#F5F5F5" accent="#22C55E"
                onPick={(m: any) => { setThemeMode(m); setPicker(false); }} />
              <ThemeOption mode="light" Icon={Sun} label="Light" active={themeMode === "light"}
                previewBg="#F4F5F3" previewCard="#E6E7E4" previewText="#111311" accent="#16A34A"
                onPick={(m: any) => { setThemeMode(m); setPicker(false); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* THREE-PLAN PAYWALL */}
      <Paywall visible={paywallOpen} onClose={closePaywall} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  h1: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, marginBottom: 18 },

  micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 5 },

  headerCard: { padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
  avatarText: { color: T.green, fontSize: 20, fontFamily: FONTS.heading },
  name: { fontSize: 18, color: T.text, fontFamily: FONTS.heading },
  streakText: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },

  proCard: { padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  proIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(251,146,60,0.12)", alignItems: "center", justifyContent: "center" },
  proTitle: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
  proSubRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 3 },
  proSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },

  sectionCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden" },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 62 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 15 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.body, fontWeight: "500" },
  rowValue: { fontSize: 13, color: T.sub, fontFamily: FONTS.heading, marginRight: 8 },

  toggle: { width: 42, height: 25, borderRadius: 99, borderWidth: 1, justifyContent: "center" },
  knob: { position: "absolute", top: 2, width: 19, height: 19, borderRadius: 10, backgroundColor: "#fff" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  pickerCard: { width: "100%", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 24 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  pickerTitle: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
  pickerClose: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 9, padding: 6 },
  previewOuter: { borderRadius: 18, padding: 3 },
  previewInner: { borderRadius: 15, overflow: "hidden", padding: 14, height: 150, justifyContent: "space-between" },
  previewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  previewChip: { borderRadius: 8, height: 34, justifyContent: "center", paddingLeft: 8 },
  previewLabel: { fontSize: 13, fontFamily: FONTS.heading, marginTop: 10, textAlign: "center" },

  // paywall
  pwOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  pwCard: { backgroundColor: T.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: T.border, padding: 22, paddingBottom: 36 },
  pwHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pwCrown: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(251,191,36,0.12)", alignItems: "center", justifyContent: "center" },
  pwClose: { padding: 4 },
  pwTitle: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, marginTop: 14 },
  pwSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, marginTop: 6, lineHeight: 19 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, borderWidth: 1.5, marginBottom: 9 },
  planCrown: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 14, color: T.text, fontFamily: FONTS.heading },
  planBadge: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  planBadgeText: { fontSize: 8.5, color: T.green, fontFamily: FONTS.heading },
  planSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 1 },
  planPrice: { fontSize: 14.5, color: T.text, fontFamily: FONTS.heading },
  planPer: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
  pwNote: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  pwNoteText: { flex: 1, fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15 },
  pwCta: { backgroundColor: T.green, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 18 },
  pwCtaText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 14 },
  pwMaybe: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },

  // username gate
  gateBadge: { width: 60, height: 60, borderRadius: 18, backgroundColor: "#FBBF24", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  gateTitle: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginBottom: 8 },
  gateSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19, marginBottom: 24, maxWidth: 264 },
  gateCta: { backgroundColor: "#FBBF24", borderRadius: 14, paddingVertical: 15, paddingHorizontal: 60 },
  gateCtaText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 14 },
  gateMaybe: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
});