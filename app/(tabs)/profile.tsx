// app/(tabs)/profile.tsx
// Profile is the control panel for settings the rest of the app already reads.
// Everything here writes to AppState, so a toggle flipped here changes
// behaviour elsewhere immediately.
import { useRouter } from "expo-router";
import {
  Bell, BellRing, ChevronRight, CircleDot, Crown, Flame, LifeBuoy,
  LogOut, Mail, Palette, Ruler, Scale, Shield, Vibrate, Watch,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LogoutSheet, PrivacyScreen, SupportChat, SupportScreen } from "../../components/AccountExtras";
import AccountScreen from "../../components/AccountScreens";
import Avatar from "../../components/Avatar";
import { CaloriesScreen, GoalScreen, TargetWeightScreen, UnitsScreen } from "../../components/GoalScreens";
import GradientText from "../../components/GradientText";
import IsoM from "../../components/IsoM";
import Tap from "../../components/Tap";
import ThemePicker from "../../components/ThemePicker";
import Toggle from "../../components/Toggle";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";
import { FONTS, TIERS, ULT_COLORS, tierForStreak } from "../../constants/theme";

type View_ =
  | null | "account" | "goal" | "calories" | "targetweight" | "units"
  | "support" | "supportchat" | "privacy";

const GOAL_LABEL: Record<string, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

export default function Profile() {
  const router = useRouter();
  const {
    T, freeLocked, isPro, togglePro, openPaywall,
    plan, profile, streakDays, setStreakDays,
    settings, setSetting, themeMode, tabResetKey,
  } = useApp();

  const [themeOpen, setThemeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View_>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const s = styles(T);

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  // free users see green everywhere — the tier colours are the product
  const accent = freeLocked ? T.green : isUlt ? T.orange : tier.color;
  // IsoM takes a tier hex or the string "ultimate" for the rainbow
  const markColor = freeLocked ? T.green : tier.color;

  // every value below falls back, so a half-filled profile renders rather than
  // crashing — onboarding doesn't supply all of these
  const handle = profile.handle || profile.name?.toLowerCase() || "you";
  const email = profile.email || "—";
  const memberSince = profile.memberSince || "today";
  const heightCm = profile.heightCm || 0;

  // keep the haptics module in step with the toggle, so every buzz in the app
  // respects it — including ones fired from scroll handlers
  useEffect(() => {
    H.setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  /* tapping the Profile tab while already on it drops back to this root —
     skip the very first render, which isn't a tap */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setView(null);
    setLoading(false);
    setThemeOpen(false);
    setLogoutOpen(false);
  }, [tabResetKey]);

  /* the identity card opens the account screen behind a short load — it's
     fetching the real account record once the backend lands */
  const openAccount = () => {
    H.tap();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setView("account");
    }, 1300);
  };

  /* Logging out sends you back to onboarding. That's the real destination —
     onboarding owns the welcome screen and the sign-in step, so there's no
     separate login route to send them to. */
  const doLogout = () => {
    setLogoutOpen(false);
    setTimeout(() => router.replace("/onboarding"), 260);
  };

  const toggle = (key: keyof typeof settings) => {
    const next = !settings[key];
    setSetting(key, next);
    // buzz on enable only — buzzing as you turn haptics OFF is a contradiction
    if (next) H.tap();
  };

  const heightLabel = () => {
    if (!heightCm) return "Not set";
    if (profile.heightUnit === "cm") return `${heightCm} cm`;
    const totalIn = heightCm / 2.54;
    return `${Math.floor(totalIn / 12)}'${Math.round(totalIn % 12)}"`;
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: 20 }}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.group}>{children}</View>
    </View>
  );

  const Divider = () => <View style={s.divider} />;

  const Row = ({
    icon: Icon, label, value, onPress, danger, locked,
  }: {
    icon: any;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    locked?: boolean;
  }) => (
    <Tap onPress={onPress}>
      <View style={s.row}>
        <View style={[s.rowIcon, danger && { backgroundColor: "rgba(239,68,68,0.12)" }]}>
          <Icon size={16} color={danger ? T.red : T.green} />
        </View>
        <Text style={[s.rowLabel, danger && { color: T.red }]}>{label}</Text>
        {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
        {locked ? (
          <Crown size={15} color={T.gold} />
        ) : danger ? null : (
          <ChevronRight size={16} color={T.micro} />
        )}
      </View>
    </Tap>
  );

  const ToggleRow = ({
    icon: Icon, label, on, onSub, offSub, onToggle,
  }: {
    icon: any;
    label: string;
    on: boolean;
    onSub: string;
    offSub: string;
    onToggle: () => void;
  }) => (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Icon size={16} color={on ? T.green : T.micro} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{on ? onSub : offSub}</Text>
      </View>
      <Toggle value={on} onValueChange={onToggle} />
    </View>
  );

  const back = () => setView(null);

  /* ---------- the account loading state ---------- */
  if (loading) {
    return (
      <View style={[s.screen, { alignItems: "center", justifyContent: "center", gap: 20 }]}>
        <IsoM size={92} color={markColor} />
        <Text style={s.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  /* ---------- sub-screens ---------- */
  if (view === "account") return <View style={s.screen}><AccountScreen onBack={back} /></View>;
  if (view === "goal") return <View style={s.screen}><GoalScreen onBack={back} /></View>;
  if (view === "calories") return <View style={s.screen}><CaloriesScreen onBack={back} /></View>;
  if (view === "targetweight") return <View style={s.screen}><TargetWeightScreen onBack={back} /></View>;
  if (view === "units") return <View style={s.screen}><UnitsScreen onBack={back} /></View>;
  if (view === "privacy") return <View style={s.screen}><PrivacyScreen onBack={back} /></View>;
  if (view === "supportchat") return <View style={s.screen}><SupportChat onBack={() => setView("support")} /></View>;
  if (view === "support") {
    return (
      <View style={s.screen}>
        <SupportScreen onBack={back} onChat={() => setView("supportchat")} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 40 }}>
        {/* header — the M wears your tier */}
        <View style={s.header}>
          <View style={{ width: 42 }}>
            <IsoM size={30} color={markColor} />
          </View>
          <Text style={s.headerTitle}>PROFILE</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* IDENTITY — the whole account sits behind this */}
        <Tap onPress={openAccount}>
          <TravelBorder
            {...(!freeLocked && isUlt ? { colors: ULT_COLORS } : { color: accent })}
            cardBg={T.card}
            borderColor={T.border}
            radius={18}
          >
            <View style={s.idCard}>
              <Avatar size={50} accent={accent} />

              <View style={{ flex: 1, minWidth: 0 }}>
                {!freeLocked && isUlt ? (
                  <GradientText text={`@${handle}`} colors={ULT_COLORS} fontSize={16} fontFamily={FONTS.headingMed} />
                ) : (
                  <Text style={[s.handle, { color: accent }]}>@{handle}</Text>
                )}

                <View style={s.emailRow}>
                  <Mail size={10} color={T.micro} />
                  <Text style={s.email} numberOfLines={1}>{email}</Text>
                </View>

                <View style={[s.streakPill, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
                  <Flame size={11} color={accent} fill={accent} />
                  <Text style={[s.streakPillText, { color: accent }]}>
                    {streakDays} days{freeLocked ? "" : ` · ${tier.name}`}
                  </Text>
                </View>
              </View>

              <ChevronRight size={17} color={T.micro} />
            </View>
          </TravelBorder>
        </Tap>

        {/* PRO */}
        {freeLocked && (
          <Tap onPress={() => openPaywall("subscribe")} style={{ marginTop: 16 }}>
            <View style={s.proCard}>
              <View style={s.proIcon}>
                <Crown size={20} color={T.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.proTitle}>Upgrade to Pro</Text>
                <Text style={s.proSub}>Tier colours, full history, leaderboard rank</Text>
              </View>
              <ChevronRight size={17} color={T.gold} />
            </View>
          </Tap>
        )}

        {isPro && (
          <View style={s.proActive}>
            <Crown size={15} color={T.gold} />
            <Text style={s.proActiveText}>MOTION Pro · active</Text>
          </View>
        )}

        {/* APPEARANCE */}
        <Section title="Appearance">
          <Row
            icon={Palette}
            label="Theme"
            value={themeMode === "dark" ? "Dark" : "Light"}
            onPress={() => { H.tap(); setThemeOpen(true); }}
          />
        </Section>

        {/* DEVICES */}
        <Section title="Devices">
          <ToggleRow
            icon={Watch}
            label="Connect watch & health"
            on={settings.watch}
            onSub="Syncing steps, calories burned & heart rate"
            offSub="Off — steps & activity won't update"
            onToggle={() => toggle("watch")}
          />
        </Section>

        {/* GOALS */}
        <Section title="Goals">
          <Row
            icon={CircleDot}
            label="Goal"
            value={GOAL_LABEL[profile.goal] || "Not set"}
            onPress={() => { H.tap(); setView("goal"); }}
          />
          <Divider />
          <Row
            icon={Flame}
            label="Daily calories"
            value={`${plan.calories.toLocaleString()} cal`}
            onPress={() => { H.tap(); setView("calories"); }}
          />
          <Divider />
          <Row
            icon={Scale}
            label="Target weight"
            value={profile.targetWeight ? `${profile.targetWeight} ${profile.weightUnit}` : "Not set"}
            onPress={() => { H.tap(); setView("targetweight"); }}
          />
          <Divider />
          <Row
            icon={Ruler}
            label="Units & height"
            value={heightLabel()}
            onPress={() => { H.tap(); setView("units"); }}
          />
        </Section>

        {/* PREFERENCES */}
        <Section title="Preferences">
          <ToggleRow
            icon={Bell}
            label="Notifications"
            on={settings.notifications}
            onSub="Milestones, badges & updates"
            offSub="Off"
            onToggle={() => toggle("notifications")}
          />
          <Divider />
          <ToggleRow
            icon={BellRing}
            label="Reminders"
            on={settings.reminders}
            onSub="Nudges to log meals & protect your streak"
            offSub="Off"
            onToggle={() => toggle("reminders")}
          />
          <Divider />
          <ToggleRow
            icon={Vibrate}
            label="Haptics"
            on={settings.haptics}
            onSub="Buzz on toggles, steppers & saves"
            offSub="Off"
            onToggle={() => toggle("haptics")}
          />
        </Section>

        {/* ACCOUNT */}
        <Section title="Account">
          <Row icon={LifeBuoy} label="Support" onPress={() => { H.tap(); setView("support"); }} />
          <Divider />
          <Row icon={Shield} label="Privacy" onPress={() => { H.tap(); setView("privacy"); }} />
          <Divider />
          <Row icon={LogOut} label="Log out" danger onPress={() => { H.tap(); setLogoutOpen(true); }} />
        </Section>

        <Text style={s.memberSince}>Member since {memberSince}</Text>

        {/* DEV — streak tier preview. Remove before launch. */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>Dev preview · streak tier</Text>
        <View style={s.tierRow}>
          {[1, 2, 3, 4, 5].map((i) => {
            const t = TIERS[i as 1 | 2 | 3 | 4 | 5];
            const days = [2, 6, 10, 14, 20][i - 1];
            const on = tier.name === t.name;
            const ult = t.color === "ultimate";
            const col = ult ? "#A855F7" : t.color;
            return (
              <Pressable
                key={t.name}
                onPress={() => { H.tick(); setStreakDays(days); }}
                style={[
                  s.tierChip,
                  { borderColor: on ? col : T.border, backgroundColor: on ? `${col}22` : T.card },
                ]}
              >
                <Text style={[s.tierChipText, { color: on ? col : T.sub }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* DEV — free/Pro flip */}
        <Pressable onPress={togglePro} style={s.devChip}>
          <Text style={s.devText}>DEV · {isPro ? "PRO" : "FREE"} · tap to flip</Text>
        </Pressable>
      </ScrollView>

      <ThemePicker visible={themeOpen} onClose={() => setThemeOpen(false)} />
      <LogoutSheet visible={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={doLogout} />
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 18, letterSpacing: 0.7, color: T.text, fontFamily: FONTS.heading },

    loadingText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, letterSpacing: 1 },

    idCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    handle: { fontSize: 16, fontFamily: FONTS.headingMed },
    emailRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2, marginBottom: 5 },
    email: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, flexShrink: 1 },
    streakPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    streakPillText: { fontSize: 10.5, fontFamily: FONTS.headingMed },

    proCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}55`, borderRadius: 16, padding: 14 },
    proIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(251,191,36,0.12)", alignItems: "center", justifyContent: "center" },
    proTitle: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    proSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    proActive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}55`, borderRadius: 14, paddingVertical: 11 },
    proActiveText: { fontSize: 12.5, color: T.gold, fontFamily: FONTS.headingMed },

    sectionLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase", marginLeft: 4, marginBottom: 8 },
    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 54 },

    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    rowLabel: { flex: 1, fontSize: 14, color: T.text, fontFamily: FONTS.body },
    rowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    rowValue: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed, marginRight: 6, maxWidth: 130 },

    memberSince: { textAlign: "center", fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 18 },

    tierRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tierChip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
    tierChipText: { fontSize: 11, fontFamily: FONTS.headingMed },

    devChip: { alignSelf: "flex-start", marginTop: 14, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
    devText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body, letterSpacing: 0.5 },
  });