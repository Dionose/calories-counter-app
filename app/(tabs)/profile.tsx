// app/(tabs)/profile.tsx
import { Bell, Check, ChevronRight, Crown, Flame, Lock, LogOut, Mic, Moon, Palette, ScanBarcode, Shield, Sun, Target, User, Vibrate, Watch, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import IsoM from "../../components/IsoM";
import PageHeader from "../../components/PageHeader";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { FONTS, TIERS, tierForStreak } from "../../constants/theme";

// DEV: a day count that lands squarely in each tier, for previewing the M
const TIER_PREVIEW: { tier: 1 | 2 | 3 | 4 | 5; days: number }[] = [
  { tier: 1, days: 2 },
  { tier: 2, days: 6 },
  { tier: 3, days: 10 },
  { tier: 4, days: 14 },
  { tier: 5, days: 20 },
];

function Toggle({ on, onPress, T }: { on: boolean; onPress: () => void; T: any }) {
  const s = styles(T);
  return (
    <Pressable onPress={onPress} style={[s.toggle, { backgroundColor: on ? T.green : T.cardHi, borderColor: on ? T.green : T.border }]}>
      <View style={[s.knob, { left: on ? 19 : 2 }]} />
    </Pressable>
  );
}

function Row({ icon: Icon, label, value, danger, toggle, toggled, onToggle, onPress, locked, T }: any) {
  const s = styles(T);
  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: danger ? "rgba(239,68,68,0.1)" : T.greenBg }]}>
        <Icon size={17} color={danger ? T.red : T.green} />
      </View>
      <Text style={[s.rowLabel, { color: danger ? T.red : T.text }]}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {locked ? <Crown size={16} color={T.gold} />
        : toggle ? <Toggle on={toggled} onPress={onToggle} T={T} />
        : <ChevronRight size={17} color={T.micro} />}
    </Pressable>
  );
}

function Section({ title, children, T }: { title: string; children: React.ReactNode; T: any }) {
  const s = styles(T);
  const items = React.Children.toArray(children);
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ marginLeft: 4, marginBottom: 8 }}><Text style={s.micro}>{title}</Text></View>
      <View style={s.sectionCard}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={s.divider} />}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

function ThemeOption({ mode, Icon, label, active, previewBg, previewCard, previewText, accent, onPick, T }: any) {
  const s = styles(T);
  return (
    <Pressable style={{ flex: 1 }} onPress={() => onPick(mode)}>
      <View style={[s.previewOuter, { backgroundColor: active ? T.green : T.border }]}>
        <View style={[s.previewInner, { backgroundColor: previewBg }]}>
          <View style={s.previewTop}>
            <Icon size={18} color={accent} />
            {active && <View style={s.previewCheck}><Check size={12} color="#fff" /></View>}
          </View>
          <View>
            <View style={{ height: 8, width: "70%", borderRadius: 4, backgroundColor: previewCard, marginBottom: 6 }} />
            <View style={{ height: 8, width: "45%", borderRadius: 4, backgroundColor: accent }} />
          </View>
          <View style={[s.previewChip, { backgroundColor: previewCard }]}>
            <Text style={{ fontSize: 11, color: previewText, fontFamily: FONTS.heading }}>1,235 cal</Text>
          </View>
        </View>
      </View>
      <Text style={[s.previewLabel, { color: active ? T.green : T.text }]}>{label}</Text>
    </Pressable>
  );
}

// ---- username Pro-gate wall ----
function UsernameGate({ back, onUpgrade, T }: { back: () => void; onUpgrade: () => void; T: any }) {
  const s = styles(T);
  return (
    <View style={{ padding: 24, paddingTop: 60, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
      <View style={s.gateBadge}><Lock size={26} color="#0A0A0A" /></View>
      <Text style={s.gateTitle}>Go Pro to change your username</Text>
      <Text style={s.gateSub}>Changing your username is a Pro feature. Upgrade to Pro to edit it anytime.</Text>
      <Pressable onPress={onUpgrade} style={s.gateCta}><Text style={s.gateCtaText}>Upgrade to Pro</Text></Pressable>
      <Pressable onPress={back} style={{ marginTop: 14 }}><Text style={s.gateMaybe}>Maybe later</Text></Pressable>
    </View>
  );
}

export default function Profile() {
  const {
    T, freeLocked, openPaywall,
    themeMode, setThemeMode, plan, profile, streakDays, setStreakDays,
  } = useApp();
  const [picker, setPicker] = useState(false);
  const [watch, setWatch] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [sub, setSub] = useState<"main" | "username">("main");

  const s = styles(T);
  const tier = tierForStreak(streakDays);
  const flameColor = tier.color === "ultimate" ? T.orange : tier.color;

  const goalLabel = profile.goal === "lose" ? "Lose weight" : profile.goal === "gain" ? "Gain weight" : "Maintain";

  if (sub === "username") {
    return <UsernameGate back={() => setSub("main")} onUpgrade={() => { setSub("main"); openPaywall("subscribe"); }} T={T} />;
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll}>
        <PageHeader title="Profile" />

        {/* header card */}
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={s.headerCard}>
            <View style={s.avatar}><Text style={s.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{profile.name}</Text>
              <View style={[s.rowCenter, { marginTop: 3 }]}>
                <Flame size={12} color={flameColor} fill={flameColor} />
                <Text style={s.streakText}>{streakDays}-day streak · {tier.name}</Text>
              </View>
            </View>
          </View>
        </TravelBorder>

        {/* Pro card — opens the one global paywall */}
        <Pressable style={{ marginTop: 12, marginBottom: 20 }} onPress={() => openPaywall("subscribe")}>
          <TravelBorder color={T.orange} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={s.proCard}>
              <View style={s.proIcon}><Crown size={22} color={T.orange} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.proTitle}>{freeLocked ? "Upgrade to Pro" : "MOTION Pro · active"}</Text>
                <View style={s.proSubRow}>
                  <Text style={s.proSub}>Motion Voice AI</Text>
                  <Mic size={12} color={T.sub} />
                  <Text style={s.proSub}>· barcode</Text>
                  <ScanBarcode size={12} color={T.sub} />
                  <Text style={s.proSub}>& more</Text>
                </View>
              </View>
              <ChevronRight size={18} color={T.micro} />
            </View>
          </TravelBorder>
        </Pressable>

        {/* DEV tier switcher — preview the M in every tier. Remove before launch. */}
        <View style={s.devCard}>
          <Text style={s.devLabel}>DEV · TIER PREVIEW</Text>
          <Text style={s.devHint}>
            Sets your streak so you can see the M, the flame and the calendar in each tier.
            {freeLocked ? " You're on FREE, so the M stays green — flip the DEV chip on Home to see tier colours." : ""}
          </Text>

          <View style={s.devMarkRow}>
            <IsoM size={54} color={freeLocked ? T.green : tier.color} />
            <View style={{ flex: 1 }}>
              <Text style={s.devMarkName}>{freeLocked ? "Free · plain green" : tier.name}</Text>
              <Text style={s.devMarkDays}>{streakDays} day{streakDays === 1 ? "" : "s"}</Text>
            </View>
          </View>

          <View style={s.devTierRow}>
            {TIER_PREVIEW.map(({ tier: tr, days }) => {
              const tt = TIERS[tr];
              const on = tierForStreak(streakDays).name === tt.name;
              const swatch = tt.color === "ultimate" ? "#8B5CF6" : tt.color;
              return (
                <Pressable
                  key={tr}
                  onPress={() => setStreakDays(days)}
                  style={[s.devTierChip, on && { borderColor: swatch, backgroundColor: `${swatch}22` }]}
                >
                  <View style={[s.devTierDot, { backgroundColor: swatch }]} />
                  <Text style={[s.devTierText, on && { color: swatch }]}>{tt.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Section title="Appearance" T={T}>
          <Row icon={Palette} label="Theme" value={themeMode === "dark" ? "Dark" : "Light"} onPress={() => setPicker(true)} T={T} />
        </Section>

        <Section title="Devices" T={T}>
          <Row icon={Watch} label="Connect watch & health" toggle toggled={watch} onToggle={() => setWatch(!watch)} T={T} />
        </Section>

        <Section title="Goals" T={T}>
          <Row icon={Target} label="Goal" value={goalLabel} T={T} />
          <Row icon={Target} label="Daily calories" value={`${plan.calories.toLocaleString()} cal`} T={T} />
          <Row icon={Target} label="Target weight" value={`${profile.targetWeight} ${profile.weightUnit}`} T={T} />
          <Row icon={Target} label="Units" value={`${profile.weightUnit} / cm`} T={T} />
        </Section>

        <Section title="Account" T={T}>
          <Row icon={User} label="Username" locked={freeLocked} onPress={() => (freeLocked ? setSub("username") : null)} T={T} />
          <Row icon={User} label="Personal info" T={T} />
          <Row icon={Lock} label="Password" T={T} />
          <Row icon={Bell} label="Reminders" toggle toggled={reminders} onToggle={() => setReminders(!reminders)} T={T} />
          <Row icon={Vibrate} label="Haptics" toggle toggled={haptics} onToggle={() => setHaptics(!haptics)} T={T} />
          <Row icon={Shield} label="Privacy" T={T} />
          <Row icon={LogOut} label="Log out" danger T={T} />
        </Section>
      </ScrollView>

      {/* THEME PICKER POPUP */}
      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setPicker(false)}>
          <Pressable style={s.pickerCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Choose your theme</Text>
              <Pressable onPress={() => setPicker(false)} style={s.pickerClose}><X size={15} color={T.sub} /></Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <ThemeOption mode="dark" Icon={Moon} label="Dark" active={themeMode === "dark"}
                previewBg="#0A0A0A" previewCard="#242424" previewText="#F5F5F5" accent="#22C55E"
                onPick={(m: any) => { setThemeMode(m); setPicker(false); }} T={T} />
              <ThemeOption mode="light" Icon={Sun} label="Light" active={themeMode === "light"}
                previewBg="#F4F5F3" previewCard="#E6E7E4" previewText="#111311" accent="#16A34A"
                onPick={(m: any) => { setThemeMode(m); setPicker(false); }} T={T} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    scroll: { padding: 16, paddingTop: 60, paddingBottom: 40 },

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

    devCard: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 15, marginBottom: 20 },
    devLabel: { fontSize: 9, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body },
    devHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 5, lineHeight: 16 },
    devMarkRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12, marginBottom: 12 },
    devMarkName: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    devMarkDays: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    devTierRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    devTierChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.border, backgroundColor: T.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
    devTierDot: { width: 9, height: 9, borderRadius: 3 },
    devTierText: { fontSize: 11, color: T.sub, fontFamily: FONTS.headingMed },

    sectionCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 62 },
    row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 15 },
    rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    rowLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.bodyMed },
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

    gateBadge: { width: 60, height: 60, borderRadius: 18, backgroundColor: T.gold, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    gateTitle: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginBottom: 8 },
    gateSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19, marginBottom: 24, maxWidth: 264 },
    gateCta: { backgroundColor: T.gold, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 60 },
    gateCtaText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 14 },
    gateMaybe: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });