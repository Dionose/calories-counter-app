// app/(tabs)/profile.tsx
// Profile is the control panel for settings the rest of the app already reads.
// Everything here writes to AppState, so a toggle flipped here changes
// behaviour elsewhere immediately — and now persists to Supabase too.
//
// It also owns the app's ONE dev switch. That lives here rather than being
// scattered across screens because two dev controls that can disagree is
// worse than none: the tier chips used to overwrite the real streak while the
// calendar kept drawing real tiles, and neither screen looked obviously wrong.
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Bell, BellRing, ChevronRight, CircleDot, Crown, Flame, LifeBuoy,
  LogOut, Palette, Ruler, Scale, Shield, Vibrate, Watch,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LogoutSheet, PrivacyScreen, SupportChat, SupportScreen } from "../../components/AccountExtras";
import AccountScreen from "../../components/AccountScreens";
import Avatar from "../../components/Avatar";
import { CaloriesScreen, GoalScreen, TargetWeightScreen, UnitsScreen } from "../../components/GoalScreens";
import GradientText from "../../components/GradientText";
import Icon, { IconName } from "../../components/Icon";
import IsoM from "../../components/IsoM";
import Tap from "../../components/Tap";
import ThemePicker from "../../components/ThemePicker";
import Toggle from "../../components/Toggle";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { signOut } from "../../constants/auth";
import * as H from "../../constants/haptics";
import { formatMemberSince } from "../../constants/profile";
import { FONTS, TIERS, ULT_COLORS, tierForStreak } from "../../constants/theme";
import { deleteWeighIn, loadWeighIns, saveWeighIn, toKg } from "../../constants/weight";

type View_ =
  | null | "account" | "goal" | "calories" | "targetweight" | "units"
  | "support" | "supportchat" | "privacy";

const GOAL_LABEL: Record<string, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

/** the flame animation for a tier — a dedicated file per tier reads far better
    than one generic flame tinted five ways */
const FLAME_FOR_TIER: Record<string, IconName> = {
  Spark: "flameSpark",
  Warming: "flameWarming",
  Hot: "flameHot",
  "Red-hot": "flameRedhot",
  Ultimate: "flameUltimate",
};

/* ---------- DEV SEED SHAPE ----------
   Ten readings, one every three days, ending today.

   The WOBBLE is the point. Real weight doesn't fall in a straight line — it
   drops, bounces, drops further — and a chart built from two readings can't
   show that, so the seeded set alternates above and below a gently falling
   trend. That's the up-down-up-down shape you'd see on a real user's chart
   after a month. */
const SEED_COUNT = 10;
const SEED_GAP_DAYS = 3;
const SEED_TREND_PER_READING = 0.28;   // kg drifting down each time
const SEED_WOBBLE = [0, 0.7, -0.5, 0.9, -0.3, 0.6, -0.8, 0.4, -0.6, 0.2];

/** N days ago as YYYY-MM-DD in the DEVICE's timezone — same reasoning as
    todayLocal(): toISOString() shifts to UTC and can file a reading under the
    wrong day. */
function dayAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Profile() {
  const router = useRouter();
  const {
    T, freeLocked, isPro, togglePro, openPaywall,
    plan, profile, streakDays, setDemoStreak,
    settings, setSetting, themeMode, tabResetKey,
    devMode, toggleDevMode, userId,
  } = useApp();

  const [themeOpen, setThemeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View_>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  /* ---------- ARRIVING FROM SOMEWHERE ELSE ----------
     The leaderboard sends `?open=region` when someone has no region set and so
     can't appear on the Regional board. It lands them on the country picker
     itself rather than on a settings list to hunt through — the message that
     names a problem should also carry the fix.

     CLEARED IMMEDIATELY after reading: without that, every later tap on the
     Profile tab would reopen the picker, because the stale parameter is still
     sitting in the route. Same trap Stats hit with ?view=weight. */
  const params = useLocalSearchParams<{ open?: string }>();
  const [accountSub, setAccountSub] = useState<"main" | "region">("main");

  useEffect(() => {
    if (params.open === "region") {
      setAccountSub("region");
      setView("account");
      router.setParams({ open: undefined });
    }
  }, [params.open]);

  /* dev seeding — `seedMsg` reports what happened, because these buttons write
     to the database and a silent button that touched real rows is unnerving */
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const s = styles(T);

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  // free users see green everywhere — the tier colours are the product
  const accent = freeLocked ? T.green : isUlt ? T.orange : tier.color;
  // IsoM takes a tier hex or the string "ultimate" for the rainbow
  const markColor = freeLocked ? T.green : tier.color;
  const flameAnim = FLAME_FOR_TIER[tier.name] || "flameSpark";

  // every value below falls back, so a half-filled profile renders rather than
  // crashing — onboarding doesn't supply all of these
  const handle = profile.handle || profile.name?.toLowerCase() || "you";
  const email = profile.email || "—";
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
    setAccountSub("main");
    setLoading(false);
    setThemeOpen(false);
    setLogoutOpen(false);
    setSeedMsg(null);
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

  /* ---------- DEV: FILL THE WEIGHT CHART ----------
     The chart draws one point per weigh-in, and saveWeighIn upserts on
     (user, date) — so entering ten numbers today leaves you with ONE row, and
     a chart that can only ever draw a straight line. This writes ten rows on
     ten different dates, which is the only way to see the real shape without
     waiting a month.

     Anchored to the user's own start weight so the seeded readings sit in a
     sensible place next to their plan line. */
  const seedWeighIns = async () => {
    if (!userId || seedBusy) return;
    H.tap();
    setSeedBusy(true);
    setSeedMsg(null);

    const unit = (profile.weightUnit || "kg") as "kg" | "lbs";
    const startKg = toKg(profile.startWeight || 80, unit);

    let written = 0;
    let failed: string | null = null;

    for (let i = 0; i < SEED_COUNT; i++) {
      /* i = 0 is the OLDEST reading, so the trend falls as i grows and the
         newest lands nearest today */
      const kg = startKg - SEED_TREND_PER_READING * i + SEED_WOBBLE[i];
      const day = dayAgo((SEED_COUNT - 1 - i) * SEED_GAP_DAYS);

      const { error } = await saveWeighIn(userId, kg, "kg", day);
      if (error) { failed = error; break; }
      written++;
    }

    setSeedBusy(false);
    setSeedMsg(
      failed
        ? `Stopped after ${written} — ${failed}`
        : `Wrote ${written} weigh-ins across the last ${(SEED_COUNT - 1) * SEED_GAP_DAYS} days. Open Stats → Weight.`
    );
  };

  /* ---------- DEV: WIPE THEM ----------
     Deletes every weigh-in on this account. There's no undo, which is fine in
     dev and is exactly why this must never ship. */
  const clearWeighIns = async () => {
    if (!userId || seedBusy) return;
    H.warn();
    setSeedBusy(true);
    setSeedMsg(null);

    const { entries } = await loadWeighIns(userId);
    let removed = 0;

    for (const e of entries) {
      if (!e.id) continue;
      const { error } = await deleteWeighIn(e.id);
      if (!error) removed++;
    }

    setSeedBusy(false);
    setSeedMsg(`Deleted ${removed} weigh-ins. The chart is empty now.`);
  };

  /* Logging out lands on SIGN IN, not onboarding. Someone with an account
     shouldn't have to answer thirty questions again to get back in — and
     onboarding's welcome screen has its own link across for people who
     genuinely are new.
     The signOut() call is what actually ends the session. Without it the
     token stays in AsyncStorage and the next launch walks straight back into
     the app, which looks like the logout button doesn't work. */
  const doLogout = async () => {
    setLogoutOpen(false);
    await signOut();
    router.replace("/signin");
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

  /* a row whose icon is either an ANIMATION (when we have one) or a Lucide
     fallback (when we don't). Passing `anim` swaps it — nothing else changes.
     `animSize` exists because not every Lottie fills its canvas the same way:
     the notification bell is an illustration that sits smaller in its frame,
     so it needs rendering larger to look the same size as the line icons. */
  const Row = ({
    icon: LucideIcon, anim, animSize = 20, label, value, onPress, danger, locked,
  }: {
    icon?: any;
    anim?: IconName;
    animSize?: number;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    locked?: boolean;
  }) => (
    <Tap onPress={onPress}>
      <View style={s.row}>
        <View style={[s.rowIcon, danger && { backgroundColor: "rgba(239,68,68,0.12)" }]}>
          {anim
            ? <Icon name={anim} size={animSize} mode="loop" />
            : <LucideIcon size={16} color={danger ? T.red : T.green} />}
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

  /* the animation plays only when the toggle is ON — switched off it falls
     back to the grey Lucide icon, which reads as inactive far more clearly
     than a moving green one would */
  const ToggleRow = ({
    icon: LucideIcon, anim, animSize = 20, label, on, onSub, offSub, onToggle,
  }: {
    icon?: any;
    anim?: IconName;
    animSize?: number;
    label: string;
    on: boolean;
    onSub: string;
    offSub: string;
    onToggle: () => void;
  }) => (
    <View style={s.row}>
      <View style={s.rowIcon}>
        {anim && on
          ? <Icon name={anim} size={animSize} mode="loop" />
          : <LucideIcon size={16} color={on ? T.green : T.micro} />}
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
  if (view === "account") {
    return (
      <View style={s.screen}>
        <AccountScreen
          /* normally "main"; "region" when the leaderboard sent them here */
          initialSub={accountSub}
          onBack={() => { setAccountSub("main"); back(); }}
        />
      </View>
    );
  }
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
                  {/* the animated envelope, small — it's a detail line, not a row */}
                  <Icon name="email" size={14} mode="loop" />
                  <Text style={s.email} numberOfLines={1}>{email}</Text>
                </View>

                <View style={[s.streakPill, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
                  {/* the tier's own flame — free users get the plain Spark one */}
                  <Icon name={freeLocked ? "flameSpark" : flameAnim} size={14} mode="loop" />
                  <Text style={[s.streakPillText, { color: accent }]}>
                    {streakDays} {streakDays === 1 ? "day" : "days"}{freeLocked ? "" : ` · ${tier.name}`}
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

        {/* APPEARANCE — the icon shows WHICH theme you're on: moon for dark,
            sun for light. More useful than a generic palette. */}
        <Section title="Appearance">
          <Row
            icon={Palette}
            anim={themeMode === "dark" ? "moonTheme" : "sunTheme"}
            label="Theme"
            value={themeMode === "dark" ? "Dark" : "Light"}
            onPress={() => { H.tap(); setThemeOpen(true); }}
          />
        </Section>

        {/* DEVICES — hand-built watch: a heartbeat draws across the face, since
            this row is health sync rather than a watch setting */}
        <Section title="Devices">
          <ToggleRow
            icon={Watch}
            anim="watchHealth"
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
            anim="targetBullseye"
            label="Goal"
            value={GOAL_LABEL[profile.goal] || "Not set"}
            onPress={() => { H.tap(); setView("goal"); }}
          />
          <Divider />
          <Row
            icon={Flame}
            anim={freeLocked ? "flameSpark" : flameAnim}
            label="Daily calories"
            value={`${plan.calories.toLocaleString()} cal`}
            onPress={() => { H.tap(); setView("calories"); }}
          />
          <Divider />
          <Row
            icon={Scale}
            anim="scale"
            label="Target weight"
            value={profile.targetWeight ? `${profile.targetWeight} ${profile.weightUnit}` : "Not set"}
            onPress={() => { H.tap(); setView("targetweight"); }}
          />
          <Divider />
          <Row
            icon={Ruler}
            anim="ruler"
            label="Units & height"
            value={heightLabel()}
            onPress={() => { H.tap(); setView("units"); }}
          />
        </Section>

        {/* PREFERENCES — the notification bell is an illustration that sits
            smaller in its canvas than the line icons, so it renders larger */}
        <Section title="Preferences">
          <ToggleRow
            icon={Bell}
            anim="notification"
            animSize={30}
            label="Notifications"
            on={settings.notifications}
            onSub="Milestones, badges & updates"
            offSub="Off"
            onToggle={() => toggle("notifications")}
          />
          <Divider />
          <ToggleRow
            icon={BellRing}
            anim="reminderBell"
            label="Reminders"
            on={settings.reminders}
            onSub="Nudges to log meals & protect your streak"
            offSub="Off"
            onToggle={() => toggle("reminders")}
          />
          <Divider />
          <ToggleRow
            icon={Vibrate}
            anim="haptics"
            label="Haptics"
            on={settings.haptics}
            onSub="Buzz on toggles, steppers & saves"
            offSub="Off"
            onToggle={() => toggle("haptics")}
          />
        </Section>

        {/* ACCOUNT */}
        <Section title="Account">
          <Row icon={LifeBuoy} anim="support" label="Support" onPress={() => { H.tap(); setView("support"); }} />
          <Divider />
          <Row icon={Shield} anim="privacy" label="Privacy" onPress={() => { H.tap(); setView("privacy"); }} />
          <Divider />
          <Row icon={LogOut} anim="logout" label="Log out" danger onPress={() => { H.tap(); setLogoutOpen(true); }} />
        </Section>

        {/* ⚠️ FORMATTED, and derived from created_at rather than signup_date.
            signup_date has no default from the app, so Postgres fills it with
            the SERVER's date — and Postgres runs in UTC. Signing up at 19:22
            in Edmonton is 01:22 the next day in UTC, so it read a day late.
            See localDateFrom() in constants/profile.ts. */}
        <Text style={s.memberSince}>Member since {formatMemberSince(profile.memberSince)}</Text>

        {/* ================= DEV ONLY =================
            ONE master switch for every piece of fake data in the app. Turning
            it on shows a scripted streak here AND the demo history on the
            calendar and Stats, so the whole app tells one consistent story —
            which is what you need when showing someone the tier colours
            without them logging for three weeks first.

            Turning it OFF is also the pre-launch check: if the app looks right
            with this off, nothing fake is left anywhere.

            Remove this whole block before launch. */}
        <View style={s.devPanel}>
          <Pressable
            onPress={() => { H.tick(); toggleDevMode(); }}
            style={[s.devMaster, devMode && s.devMasterOn]}
          >
            <View style={[s.devDot, devMode && { backgroundColor: T.gold }]} />
            <Text style={[s.devMasterText, devMode && { color: T.gold }]}>
              DEV MODE · {devMode ? "ON — showing demo data" : "OFF — everything real"}
            </Text>
          </Pressable>

          {/* the tier chips only exist in dev mode. Outside it they'd be
              overwriting a real streak with a fake one, which is exactly the
              confusion this switch was built to remove. */}
          {devMode && (
            <>
              <Text style={s.devHint}>
                Pick a tier to preview. The calendar switches to demo history at the same time.
              </Text>
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
                      onPress={() => { H.tick(); setDemoStreak(days); }}
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

              {/* WEIGH-IN SEEDING — unlike the tier chips, these write REAL
                  rows to Supabase. That's the only way to test the chart:
                  the weigh-in table allows one row per day, so the shape of a
                  month's readings can't be faked from today alone.
                  Clearing removes real data with no undo. */}
              <Text style={s.devHint}>
                Weight chart test data — these write real rows to your account.
              </Text>
              <View style={s.tierRow}>
                <Pressable
                  onPress={seedWeighIns}
                  disabled={seedBusy}
                  style={[s.tierChip, { borderColor: `${T.green}66`, backgroundColor: `${T.green}18`, opacity: seedBusy ? 0.5 : 1 }]}
                >
                  <Text style={[s.tierChipText, { color: T.green }]}>
                    {seedBusy ? "Working…" : `Seed ${SEED_COUNT} weigh-ins`}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={clearWeighIns}
                  disabled={seedBusy}
                  style={[s.tierChip, { borderColor: `${T.red}66`, backgroundColor: "rgba(239,68,68,0.10)", opacity: seedBusy ? 0.5 : 1 }]}
                >
                  <Text style={[s.tierChipText, { color: T.red }]}>Clear all weigh-ins</Text>
                </Pressable>
              </View>

              {seedMsg && <Text style={s.devResult}>{seedMsg}</Text>}
            </>
          )}

          {/* the Pro flip stays OUTSIDE dev mode — free vs Pro is a real
              product state, not fake data, and it needs testing either way */}
          <Pressable onPress={togglePro} style={s.devChip}>
            <Text style={s.devText}>DEV · {isPro ? "PRO" : "FREE"} · tap to flip</Text>
          </Pressable>
        </View>
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

    /* dev panel */
    devPanel: { marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: T.border },
    devMaster: {
      flexDirection: "row", alignItems: "center", gap: 9,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    },
    devMasterOn: { borderColor: `${T.gold}66`, backgroundColor: "rgba(251,191,36,0.08)" },
    devDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
    devMasterText: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed, letterSpacing: 0.4 },
    devHint: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 12, marginBottom: 8, lineHeight: 15 },
    devResult: { fontSize: 10, color: T.sub, fontFamily: FONTS.body, marginTop: 10, lineHeight: 15 },

    tierRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tierChip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
    tierChipText: { fontSize: 11, fontFamily: FONTS.headingMed },

    devChip: { alignSelf: "flex-start", marginTop: 14, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
    devText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body, letterSpacing: 0.5 },
  });