// components/AccountScreens.tsx
// Everything behind the Profile identity card: the account overview and its
// six editors. Grouped in one file because they only exist for each other —
// splitting them into seven would spread one flow across seven places.
import { Check, Crown, Eye, EyeOff, Globe, Lock, Search } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS, ULT_COLORS, tierForStreak } from "../constants/theme";
import AtSymbol from "./AtSymbol";
import Avatar from "./Avatar";
import BackRow from "./BackRow";
import GradientText from "./GradientText";
import Icon, { IconName } from "./Icon";
import PhotoSheet from "./PhotoSheet";
import SaveBtn from "./SaveBtn";
import Tap from "./Tap";

export type AccountSub = "main" | "name" | "username" | "email" | "password" | "dob" | "region";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* A short list for now — the real one arrives with the backend, since region
   decides which Regional leaderboard you're ranked on. */
const COUNTRIES = [
  "Canada", "United States", "United Kingdom", "Ireland", "Australia",
  "New Zealand", "Nigeria", "Ghana", "Kenya", "South Africa",
  "India", "Pakistan", "Bangladesh", "Philippines", "Indonesia",
  "Germany", "France", "Spain", "Italy", "Netherlands",
  "Sweden", "Norway", "Denmark", "Poland", "Portugal",
  "Brazil", "Mexico", "Argentina", "Colombia", "Chile",
  "Japan", "South Korea", "China", "Singapore", "UAE",
];

/* ---------- the Pro gate ---------- */
function ProGate({ title, line, onBack }: { title: string; line: string; onBack: () => void }) {
  const { T, openPaywall } = useApp();
  const s = styles(T);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Back" onBack={onBack} />
      <View style={s.gateWrap}>
        <View style={s.gateIcon}>
          <Lock size={26} color="#0A0A0A" />
        </View>
        <Text style={s.gateTitle}>Go Pro to change your {title.toLowerCase()}</Text>
        <Text style={s.gateLine}>{line} Upgrade to Pro to edit it anytime.</Text>

        <Tap onPress={() => { H.tap(); openPaywall("subscribe"); }} style={{ width: "100%", maxWidth: 280 }}>
          <View style={s.gateCta}>
            <Text style={s.gateCtaText}>Upgrade to Pro</Text>
          </View>
        </Tap>

        <Pressable onPress={onBack} style={{ marginTop: 14 }} hitSlop={10}>
          <Text style={s.gateLater}>Maybe later</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---------- a single-field editor ---------- */
function EditScreen({
  title, label, initial, hint, note, keyboard, autoCapitalize, glowColor, ultimate, anim, onBack, onSave,
}: {
  title: string;
  label: string;
  initial: string;
  hint?: string;
  note?: string;
  keyboard?: "email-address" | "default";
  autoCapitalize?: "none" | "words";
  glowColor?: string;
  ultimate?: boolean;
  anim?: IconName;
  onBack: () => void;
  onSave: (v: string) => void;
}) {
  const { T } = useApp();
  const s = styles(T);
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);

  const save = () => {
    H.success();
    setSaved(true);
    onSave(v.trim());
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackRow title={title} onBack={onBack} />

      {/* the row's own animation, large, as the screen's mark */}
      {anim && !glowColor && (
        <View style={s.editHeroIcon}>
          <Icon name={anim} size={54} mode="loop" />
        </View>
      )}

      {glowColor && (
        <View style={s.glowPreview}>
          {ultimate ? (
            <GradientText text={v || "@you"} colors={ULT_COLORS} fontSize={24} fontFamily={FONTS.heading} />
          ) : (
            <Text style={[s.glowText, { color: glowColor }]}>{v || "@you"}</Text>
          )}
        </View>
      )}

      {note ? <Text style={s.note}>{note}</Text> : null}

      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={v}
        onChangeText={setV}
        style={s.input}
        keyboardType={keyboard || "default"}
        autoCapitalize={autoCapitalize || "none"}
        autoCorrect={false}
        placeholderTextColor={T.micro}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      <SaveBtn saved={saved} disabled={!v.trim()} onPress={save} />
    </ScrollView>
  );
}

/* ---------- password ---------- */
function PasswordScreen({ onBack }: { onBack: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const rules = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "One capital letter", ok: /[A-Z]/.test(pw) },
    { label: "One small letter", ok: /[a-z]/.test(pw) },
    { label: "One number", ok: /[0-9]/.test(pw) },
    { label: "One symbol ( ? ! * # … )", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const allOk = rules.every((r) => r.ok);
  const match = cf.length > 0 && cf === pw;
  const ready = allOk && match;

  const save = () => {
    H.success();
    setSaved(true);
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackRow title="Change password" onBack={onBack} />

      <View style={s.editHeroIcon}>
        <Icon name="password" size={54} mode="loop" />
      </View>

      <Text style={s.fieldLabel}>New password</Text>
      <View style={s.pwWrap}>
        <TextInput
          value={pw}
          onChangeText={setPw}
          secureTextEntry={!show}
          placeholder="Create a strong password"
          placeholderTextColor={T.micro}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { flex: 1, marginBottom: 0, paddingRight: 44 }]}
        />
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10} style={s.pwEye}>
          {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
        </Pressable>
      </View>

      <View style={s.rulesCard}>
        {rules.map((r, i) => (
          <View key={i} style={s.ruleRow}>
            <View style={[s.ruleDot, r.ok && { backgroundColor: T.green, borderColor: T.green }]}>
              {r.ok && <Check size={11} color={T.ink} />}
            </View>
            <Text style={[s.ruleText, r.ok && { color: T.text }]}>{r.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.fieldLabel}>Confirm password</Text>
      <TextInput
        value={cf}
        onChangeText={setCf}
        secureTextEntry={!show}
        placeholder="Type it again"
        placeholderTextColor={T.micro}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          s.input,
          cf.length > 0 && { borderColor: match ? T.greenBorder : "rgba(239,68,68,0.5)" },
        ]}
      />
      {cf.length > 0 && !match && <Text style={s.mismatch}>Those don't match yet.</Text>}

      <SaveBtn saved={saved} disabled={!ready} label="Update password" savedLabel="Password updated" onPress={save} />
    </ScrollView>
  );
}

/* ---------- date of birth ----------
   Three wheels rather than a mini calendar: a birthday is twenty-odd years
   back, and paging a calendar there month by month is painful. */
const ROW_H = 40;
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 90 }, (_, i) => THIS_YEAR - 13 - i); // 13+ only

function Wheel({
  values, labels, value, onChange, width, T,
}: {
  values: number[];
  labels: string[];
  value: number;
  onChange: (v: number) => void;
  width: number;
  T: any;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));
  const s = styles(T);

  return (
    <ScrollView
      ref={ref}
      style={{ width, height: ROW_H * 5 }}
      contentContainerStyle={{ paddingVertical: ROW_H * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_H}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: idx * ROW_H }}
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / ROW_H);
        const v = values[Math.min(values.length - 1, Math.max(0, i))];
        if (v != null && v !== value) { H.tick(); onChange(v); }
      }}
    >
      {values.map((v, i) => (
        <View key={v} style={{ height: ROW_H, alignItems: "center", justifyContent: "center" }}>
          <Text style={[s.wheelText, v === value && s.wheelActive]} numberOfLines={1}>{labels[i]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function DobScreen({ onBack }: { onBack: () => void }) {
  const { T, profile, updateProfile } = useApp();
  const s = styles(T);
  // seeded from the saved value, so reopening shows what you last picked
  const [d, setD] = useState(profile.dobDay || 12);
  const [m, setM] = useState(profile.dobMonth ?? 2);
  const [y, setY] = useState(profile.dobYear || 2001);
  const [saved, setSaved] = useState(false);

  const maxDay = new Date(y, m + 1, 0).getDate();
  const day = Math.min(d, maxDay);

  const now = new Date();
  const isBirthday = now.getMonth() === m && now.getDate() === day;

  const age = useMemo(() => {
    let a = now.getFullYear() - y;
    const had = now.getMonth() > m || (now.getMonth() === m && now.getDate() >= day);
    if (!had) a -= 1;
    return a;
  }, [y, m, day]);

  const save = () => {
    H.success();
    setSaved(true);
    updateProfile({ dobDay: day, dobMonth: m, dobYear: y });
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Date of birth" onBack={onBack} />

      <View style={s.editHeroIcon}>
        <Icon name="cake" size={54} mode="loop" />
      </View>

      <Text style={s.note}>
        Your age is part of how we work out your calorie target. We'll also wish you happy birthday —
        nobody else sees this.
      </Text>

      <View style={s.wheelWrap}>
        <View style={s.wheelBand} pointerEvents="none" />
        <View style={s.wheelRow}>
          <View style={{ flex: 0.7, alignItems: "center" }}>
            <Wheel
              T={T}
              width={56}
              values={Array.from({ length: maxDay }, (_, i) => i + 1)}
              labels={Array.from({ length: maxDay }, (_, i) => String(i + 1))}
              value={day}
              onChange={setD}
            />
          </View>
          <View style={{ flex: 1.4, alignItems: "center" }}>
            <Wheel
              T={T}
              width={120}
              values={Array.from({ length: 12 }, (_, i) => i)}
              labels={MONTHS}
              value={m}
              onChange={setM}
            />
          </View>
          <View style={{ flex: 0.9, alignItems: "center" }}>
            <Wheel T={T} width={78} values={YEARS} labels={YEARS.map(String)} value={y} onChange={setY} />
          </View>
        </View>
      </View>

      <View style={s.dobSummary}>
        <Icon name="cake" size={18} mode="loop" />
        <Text style={s.dobText}>
          {MSHORT[m]} {day}, {y} · {age} years old{isBirthday ? " · today! 🎂" : ""}
        </Text>
      </View>

      <SaveBtn saved={saved} onPress={save} />
    </ScrollView>
  );
}

/* ---------- region ---------- */
function RegionScreen({ current, onBack, onSave }: { current: string; onBack: () => void; onSave: (v: string) => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(current);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(needle));
  }, [q]);

  const pick = (c: string) => {
    H.tick();
    setSel(c);
    onSave(c);
    setTimeout(onBack, 320);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56 }}>
        <BackRow title="Region" onBack={onBack} />

        <Text style={s.note}>
          This decides which Regional leaderboard you're ranked on. Your General and Total ranks don't change.
        </Text>

        <View style={s.searchBox}>
          <Search size={15} color={T.micro} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search countries"
            placeholderTextColor={T.micro}
            style={s.searchInput}
            autoCorrect={false}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40 }}>
        <View style={s.group}>
          {list.map((c, i) => {
            const on = c === sel;
            return (
              <View key={c}>
                {i > 0 && <View style={s.divider} />}
                <Tap onPress={() => pick(c)}>
                  <View style={s.countryRow}>
                    <Globe size={15} color={on ? T.green : T.micro} />
                    <Text style={[s.countryText, on && { color: T.green }]}>{c}</Text>
                    {on && <Check size={16} color={T.green} />}
                  </View>
                </Tap>
              </View>
            );
          })}
          {list.length === 0 && <Text style={s.empty}>No country matches "{q}".</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

/* ================= the account overview ================= */
export default function AccountScreen({ onBack }: { onBack: () => void }) {
  const { T, freeLocked, profile, updateProfile, streakDays } = useApp();
  const [sub, setSub] = useState<AccountSub>("main");
  const [photoOpen, setPhotoOpen] = useState(false);
  const s = styles(T);

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  const accent = freeLocked ? T.green : isUlt ? T.orange : tier.color;

  const handle = profile.handle || "you";
  const back = () => setSub("main");

  if (sub === "name") {
    return (
      <EditScreen
        title="Name"
        label="Your name"
        initial={profile.name || ""}
        autoCapitalize="words"
        anim="profile"
        note="This is how MOTION greets you, and where your avatar initials come from. Only you see it."
        onBack={back}
        onSave={(v) => updateProfile({ name: v })}
      />
    );
  }

  if (sub === "username") {
    // changing your handle is Pro — it's what the leaderboard shows
    return freeLocked ? (
      <ProGate title="Username" line="Changing your username is a Pro feature." onBack={back} />
    ) : (
      <EditScreen
        title="Username"
        label="Your username (this is what others see)"
        initial={`@${handle}`}
        hint="Change it as often as you like."
        glowColor={accent}
        ultimate={isUlt}
        onBack={back}
        onSave={(v) => updateProfile({ handle: v.replace(/^@+/, "") })}
      />
    );
  }

  if (sub === "email") {
    return (
      <EditScreen
        title="Email"
        label="Email address"
        initial={profile.email || ""}
        keyboard="email-address"
        anim="email"
        note="Update this if you've lost access to your old email — we'll send a confirmation link."
        onBack={back}
        onSave={(v) => updateProfile({ email: v })}
      />
    );
  }

  if (sub === "password") return <PasswordScreen onBack={back} />;
  if (sub === "dob") return <DobScreen onBack={back} />;
  if (sub === "region") {
    return (
      <RegionScreen
        current={profile.region || "Canada"}
        onBack={back}
        onSave={(v) => updateProfile({ region: v })}
      />
    );
  }

  const dobLabel = `${profile.dobDay} ${MSHORT[profile.dobMonth ?? 0]} ${profile.dobYear}`;

  const rows: {
    anim?: IconName;
    label: string;
    value: string;
    note?: string;
    glow?: boolean;
    mono?: boolean;
    to: AccountSub;
    locked?: boolean;
  }[] = [
    { anim: "profile", label: "Name · how we greet you", value: profile.name || "—", to: "name" },
    // no `anim` — the @ is its own component, a masked glyph with a light streak
    { label: "Username · what others see", value: `@${handle}`, glow: true, to: "username", locked: freeLocked },
    { anim: "email", label: "Email", value: profile.email || "—", to: "email" },
    { anim: "password", label: "Password", value: "••••••••••", mono: true, to: "password" },
    { anim: "cake", label: "Date of birth", value: dobLabel, note: "birthday", to: "dob" },
    { anim: "region", label: "Region", value: profile.region || "—", note: "leaderboards", to: "region" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Profile" onBack={onBack} />

        <View style={s.headWrap}>
          <Avatar size={72} badge accent={accent} onPress={() => { H.tap(); setPhotoOpen(true); }} />

          {isUlt && !freeLocked ? (
            <View style={{ marginTop: 12 }}>
              <GradientText text={`@${handle}`} colors={ULT_COLORS} fontSize={20} fontFamily={FONTS.heading} />
            </View>
          ) : (
            <Text style={[s.bigHandle, { color: accent }]}>@{handle}</Text>
          )}

          <View style={s.privateRow}>
            <Lock size={10} color={T.micro} />
            <Text style={s.privateText}>{profile.name} · only you</Text>
          </View>
        </View>

        <View style={s.group}>
          {rows.map((r, i) => (
            <View key={r.to}>
              {i > 0 && <View style={s.divider} />}
              <Tap onPress={() => { H.tap(); setSub(r.to); }}>
                <View style={s.accRow}>
                  <View style={s.rowIcon}>
                    {r.anim
                      ? <Icon name={r.anim} size={20} mode="loop" />
                      : <AtSymbol size={19} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.accLabel}>{r.label}</Text>
                    {r.glow && !freeLocked && isUlt ? (
                      <GradientText text={r.value} colors={ULT_COLORS} fontSize={14} fontFamily={FONTS.headingMed} />
                    ) : (
                      <Text
                        style={[
                          s.accValue,
                          r.glow && { color: accent },
                          r.mono && { letterSpacing: 2, fontFamily: FONTS.heading },
                        ]}
                        numberOfLines={1}
                      >
                        {r.value}
                        {r.note ? <Text style={s.accNote}>  {r.note}</Text> : null}
                      </Text>
                    )}
                  </View>
                  {r.locked ? <Crown size={15} color={T.gold} /> : null}
                </View>
              </Tap>
            </View>
          ))}
        </View>

        <Text style={s.memberSince}>Member since {profile.memberSince || "today"}</Text>
      </ScrollView>

      <PhotoSheet
        visible={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onRemove={() => updateProfile({ photoUri: null })}
      />
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    page: { padding: 16, paddingTop: 56, paddingBottom: 40 },

    headWrap: { alignItems: "center", marginBottom: 18 },
    bigHandle: { fontSize: 20, fontFamily: FONTS.heading, marginTop: 12 },
    privateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
    privateText: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },

    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 56 },

    accRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 13 },
    rowIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    accLabel: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body },
    // Bricolage, matching every other value row in the app
    accValue: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed, marginTop: 1 },
    accNote: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },

    memberSince: { textAlign: "center", fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 14 },

    /* editors */
    editHeroIcon: { alignItems: "center", marginBottom: 18 },
    fieldLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase", marginBottom: 8, marginLeft: 2 },
    input: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 13,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: T.text, fontFamily: FONTS.headingMed,
      marginBottom: 4,
    },
    hint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 6, marginLeft: 2 },
    note: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5, marginBottom: 16 },
    glowPreview: { alignItems: "center", marginBottom: 18 },
    glowText: { fontSize: 24, fontFamily: FONTS.heading },

    pwWrap: { flexDirection: "row", alignItems: "center" },
    pwEye: { position: "absolute", right: 14 },
    rulesCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 13, marginTop: 12, marginBottom: 18 },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 3 },
    ruleDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: T.micro, alignItems: "center", justifyContent: "center" },
    ruleText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    mismatch: { fontSize: 11.5, color: T.red, fontFamily: FONTS.body, marginTop: 6, marginLeft: 2 },

    /* dob */
    wheelWrap: { position: "relative", marginTop: 4 },
    wheelBand: { position: "absolute", left: 0, right: 0, top: ROW_H * 2, height: ROW_H, borderRadius: 11, backgroundColor: T.greenBg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.greenBorder },
    wheelRow: { flexDirection: "row" },
    wheelText: { fontSize: 15, color: T.sub, fontFamily: FONTS.body },
    wheelActive: { fontSize: 17.5, color: T.green, fontFamily: FONTS.headingMed },
    dobSummary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11 },
    dobText: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },

    /* region */
    searchBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11 },
    searchInput: { flex: 1, fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed, padding: 0 },
    countryRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, paddingHorizontal: 14 },
    countryText: { flex: 1, fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    empty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", padding: 22 },

    /* pro gate */
    gateWrap: { alignItems: "center", paddingHorizontal: 20, paddingTop: 26 },
    gateIcon: { width: 60, height: 60, borderRadius: 19, backgroundColor: T.gold, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    gateTitle: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginBottom: 8 },
    gateLine: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19.5, maxWidth: 270, marginBottom: 24 },
    gateCta: { backgroundColor: T.gold, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    gateCtaText: { fontSize: 14, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    gateLater: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });