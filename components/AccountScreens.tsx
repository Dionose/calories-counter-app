// components/AccountScreens.tsx
// Everything behind the Profile identity card: the account overview and its
// six editors. Grouped in one file because they only exist for each other —
// splitting them into seven would spread one flow across seven places.
//
// ⚠️ THE COUNTRY LIST LIVES IN constants/regions.ts NOW, not here. It used to
// be a local array of thirty-five, and onboarding grew its own way of setting
// a region from the phone's locale — which stored an ISO code ("CA") while
// this screen stored a name ("Canada"). The leaderboard groups on that exact
// string, so two people in the same country landed on two different Regional
// boards depending on which path set their region. One list, one format.
//
// ⚠️ EMAIL AND PASSWORD DON'T LIVE IN THE PROFILE ROW. They belong to Supabase
// Auth, and both screens here used to write to the profile table instead — so
// "Password updated" appeared and the password you sign in with never changed.
// Both now go through constants/auth.ts. See PasswordScreen and EmailScreen.
import { AlertTriangle, Check, Crown, Eye, EyeOff, Globe, Lock, Mail, Search } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import { requestEmailChange, updatePassword } from "../constants/auth";
import * as H from "../constants/haptics";
import { deleteAvatar, uploadAvatar } from "../constants/photos";
import { COUNTRIES } from "../constants/regions";
import { FONTS, ULT_COLORS, tierForStreak } from "../constants/theme";
import AtSymbol from "./AtSymbol";
import Avatar from "./Avatar";
import BackRow from "./BackRow";
import CameraSheet from "./CameraSheet";
import GradientText from "./GradientText";
import Icon, { IconName } from "./Icon";
import PhotoSheet from "./PhotoSheet";
import SaveBtn from "./SaveBtn";
import Tap from "./Tap";

export type AccountSub = "main" | "name" | "username" | "email" | "password" | "dob" | "region";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/* ---------- a single-field editor ----------
   For things that live in the PROFILE ROW and save instantly. Email is
   deliberately not one of these — see EmailScreen. */
function EditScreen({
  title, label, initial, hint, note, autoCapitalize, glowColor, ultimate, anim, onBack, onSave,
}: {
  title: string;
  label: string;
  initial: string;
  hint?: string;
  note?: string;
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
        autoCapitalize={autoCapitalize || "none"}
        autoCorrect={false}
        placeholderTextColor={T.micro}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      <SaveBtn saved={saved} disabled={!v.trim()} onPress={save} />
    </ScrollView>
  );
}

/* ================= EMAIL =================
   ⚠️ THIS DOESN'T CHANGE ANYTHING IMMEDIATELY, and saying so is most of the
   screen's job.

   Supabase sends a confirmation link to the NEW address and only completes the
   change once it's clicked. That's worth keeping rather than working around: a
   typo in an email would otherwise lock someone out of their own account for
   good — they couldn't sign in with the old address because it had been
   replaced, and couldn't receive a reset at the new one because it doesn't
   exist.

   Which means the button can't say "Saved". It says a link is on its way, and
   it says plainly that the OLD address still works until they click it —
   without that line, someone signs out expecting the new one to work and
   can't get back in. */
function EmailScreen({ current, onBack }: { current: string; onBack: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [v, setV] = useState(current);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clean = v.trim().toLowerCase();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  const changed = clean !== current.trim().toLowerCase();
  const ready = looksLikeEmail && changed && !busy;

  const send = async () => {
    if (!ready) return;
    setErr(null);
    setBusy(true);

    const { error } = await requestEmailChange(clean);

    setBusy(false);

    if (error) { setErr(error); H.warn(); return; }

    H.success();
    setSent(true);
  };

  if (sent) {
    return (
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Email" onBack={onBack} />

        <View style={s.sentWrap}>
          <View style={s.sentIcon}>
            <Mail size={26} color={T.green} />
          </View>
          <Text style={s.sentTitle}>Check your new inbox</Text>
          <Text style={s.sentBody}>
            We've sent a confirmation link to {clean}. Your email changes once you open that link.
          </Text>

          {/* the line that stops someone locking themselves out */}
          <View style={s.sentNote}>
            <AlertTriangle size={13} color={T.gold} />
            <Text style={s.sentNoteText}>
              Until then, keep signing in with {current} — it still works, and the new address
              won't until you've confirmed it.
            </Text>
          </View>

          <Tap onPress={onBack} style={{ width: "100%", marginTop: 22 }}>
            <View style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Done</Text>
            </View>
          </Tap>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackRow title="Email" onBack={onBack} />

      <View style={s.editHeroIcon}>
        <Icon name="email" size={54} mode="loop" />
      </View>

      <Text style={s.note}>
        This is what you sign in with. Change it and we'll send a confirmation link to the new
        address — nothing changes until you open it.
      </Text>

      <Text style={s.fieldLabel}>New email address</Text>
      <TextInput
        value={v}
        onChangeText={(t) => { setV(t); setErr(null); }}
        style={s.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="name@email.com"
        placeholderTextColor={T.micro}
      />

      {v.trim().length > 0 && !looksLikeEmail && (
        <Text style={s.mismatch}>That doesn't look like an email address.</Text>
      )}

      {err ? (
        <View style={s.errRow}>
          <AlertTriangle size={13} color={T.red} />
          <Text style={s.errText}>{err}</Text>
        </View>
      ) : null}

      <Tap onPress={send} style={{ marginTop: 22 }}>
        <View style={[s.primaryBtn, !ready && s.btnDisabled]}>
          {busy ? (
            <ActivityIndicator size="small" color={T.ink} />
          ) : (
            <Text style={[s.primaryBtnText, !ready && { color: T.micro }]}>
              Send confirmation link
            </Text>
          )}
        </View>
      </Tap>

      {!changed && v.trim().length > 0 && (
        <Text style={s.hint}>That's already your email.</Text>
      )}
    </ScrollView>
  );
}

/* ================= PASSWORD =================
   ⚠️ IT ASKS FOR THE CURRENT ONE, and that isn't bureaucracy.

   Supabase's updateUser({ password }) verifies nothing — it changes the
   password of whoever holds the session. Without this field, an unlocked phone
   left on a table is enough for someone to change the password, sign in
   elsewhere, and lock the owner out of their own account.

   This screen previously wrote to the profile row and showed "Password
   updated" while changing nothing at all. The risk there wasn't a break-in; it
   was the FALSE ASSURANCE — someone who thinks they've secured an account
   after sharing a password is worse off than someone who knows they haven't.

   ALL THREE FIELDS SHOW THE EYE. Two of them didn't at first, which is worse
   than none: revealing one field and finding the next still hidden reads as a
   broken toggle rather than a partial one. It matters most on the CURRENT
   password, which is typed from memory — a typo there comes back as "that's
   not your current password", which sounds like you've forgotten it. */
function PasswordScreen({ onBack }: { onBack: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rules = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "One capital letter", ok: /[A-Z]/.test(pw) },
    { label: "One small letter", ok: /[a-z]/.test(pw) },
    { label: "One number", ok: /[0-9]/.test(pw) },
    { label: "One symbol ( ? ! * # … )", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const allOk = rules.every((r) => r.ok);
  const match = cf.length > 0 && cf === pw;
  const ready = allOk && match && cur.length > 0 && !busy;

  const save = async () => {
    if (!ready) return;
    setErr(null);
    setBusy(true);

    const { error } = await updatePassword(cur, pw);

    setBusy(false);

    if (error) { setErr(error); H.warn(); return; }

    H.success();
    setSaved(true);
    setTimeout(onBack, 900);
  };

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <BackRow title="Change password" onBack={onBack} />

      <View style={s.editHeroIcon}>
        <Icon name="password" size={54} mode="loop" />
      </View>

      <Text style={s.note}>
        You'll stay signed in on this phone. Anywhere else you're signed in stays signed in too —
        this changes what you type next time, not your current session.
      </Text>

      {/* THE CHECK. First field, because it's the one that makes the rest
          safe — putting it last would read as an afterthought. */}
      <Text style={s.fieldLabel}>Your current password</Text>
      <View style={s.pwWrap}>
        <TextInput
          value={cur}
          onChangeText={(t) => { setCur(t); setErr(null); }}
          secureTextEntry={!show}
          placeholder="The one you sign in with now"
          placeholderTextColor={T.micro}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { flex: 1, marginBottom: 0, paddingRight: 44 }]}
        />
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10} style={s.pwEye}>
          {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
        </Pressable>
      </View>

      <View style={s.divider} />

      <Text style={[s.fieldLabel, { marginTop: 20 }]}>New password</Text>
      <View style={s.pwWrap}>
        <TextInput
          value={pw}
          onChangeText={(t) => { setPw(t); setErr(null); }}
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
      <View style={s.pwWrap}>
        <TextInput
          value={cf}
          onChangeText={(t) => { setCf(t); setErr(null); }}
          secureTextEntry={!show}
          placeholder="Type it again"
          placeholderTextColor={T.micro}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            s.input,
            { flex: 1, marginBottom: 0, paddingRight: 44 },
            cf.length > 0 && { borderColor: match ? T.greenBorder : "rgba(239,68,68,0.5)" },
          ]}
        />
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10} style={s.pwEye}>
          {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
        </Pressable>
      </View>

      {cf.length > 0 && !match && <Text style={s.mismatch}>Those don't match yet.</Text>}

      {err ? (
        <View style={s.errRow}>
          <AlertTriangle size={13} color={T.red} />
          <Text style={s.errText}>{err}</Text>
        </View>
      ) : null}

      <Tap onPress={save} style={{ marginTop: 22 }}>
        <View style={[
          s.primaryBtn,
          !ready && !saved && s.btnDisabled,
          saved && { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder },
        ]}>
          {busy ? (
            <ActivityIndicator size="small" color={T.ink} />
          ) : (
            <Text style={[
              s.primaryBtnText,
              !ready && !saved && { color: T.micro },
              saved && { color: T.green },
            ]}>
              {saved ? "Password updated ✓" : "Update password"}
            </Text>
          )}
        </View>
      </Tap>
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

/* ---------- region ----------
   The list comes from constants/regions.ts — the same array onboarding
   converts the phone's locale through, so the two can't disagree. */
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={s.group}>
          {list.map((c, i) => {
            const on = c === sel;
            return (
              <View key={c}>
                {i > 0 && <View style={s.rowDivider} />}
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
export default function AccountScreen({
  onBack, initialSub = "main",
}: {
  onBack: () => void;
  /* which editor to open on. Normally "main" — the leaderboard passes
     "region" when someone with no region set taps through from a Regional
     board they can't appear on. A message that names a problem should carry
     the fix with it. */
  initialSub?: AccountSub;
}) {
  const { T, freeLocked, profile, updateProfile, streakDays, userId, setAvatar, clearAvatar } = useApp();
  const [sub, setSub] = useState<AccountSub>(initialSub);
  const [photoOpen, setPhotoOpen] = useState(false);

  /* ---------- THE PROFILE PHOTO ----------
     The camera is the tall one — nearly full screen, so your face is in frame
     while the shutter stays under your thumb.

     Uploading is the slow part, so it gets its own visible state. A silent
     pause after the shutter, with the old picture still showing, reads as the
     photo having failed.

     ⚠️ REPLACING A PHOTO NEEDS AN UPDATE POLICY ON THE BUCKET. Meal photos use
     a new filename every time and only ever INSERT; the avatar uses one fixed
     name, so a second photo is an UPDATE. Without that policy Supabase refused
     it with "new row violates row-level security policy" — the first photo
     saved, every one after silently didn't, and the app kept a path pointing
     at a file that had never changed. */
  const [camOpen, setCamOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const s = styles(T);

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  const accent = freeLocked ? T.green : isUlt ? T.orange : tier.color;

  const handle = profile.handle || "you";
  const back = () => setSub("main");

  /** shared by the camera and the library — both hand back a local file */
  const saveNewPhoto = async (uri?: string) => {
    setCamOpen(false);
    if (!uri || !userId) return;

    setPhotoErr(null);
    setUploading(true);

    const { path, error } = await uploadAvatar(userId, uri);

    setUploading(false);

    if (error || !path) {
      /* say so rather than silently keeping the old picture — someone who
         just took a photo and sees no change assumes the app is broken */
      setPhotoErr(error || "Couldn't save that photo. Try again?");
      H.warn();
      return;
    }

    /* the local file shows INSTANTLY while the signed URL is fetched — see
       setAvatar in AppState. */
    setAvatar(path, uri);
    H.success();
  };

  /* removing deletes the FILE as well as the reference. Leaving the image in
     the bucket after someone asked for it to be gone isn't "removed" in any
     sense they'd recognise. */
  const removePhoto = async () => {
    clearAvatar();
    if (userId) await deleteAvatar(userId);
    H.tick();
  };

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

  /* NOT an EditScreen — it doesn't save, it sends a link. See EmailScreen. */
  if (sub === "email") return <EmailScreen current={profile.email || ""} onBack={back} />;
  if (sub === "password") return <PasswordScreen onBack={back} />;
  if (sub === "dob") return <DobScreen onBack={back} />;
  if (sub === "region") {
    return (
      <RegionScreen
        /* no default country — an empty region should look empty, so the user
           picks their own rather than silently sitting on Canada's board */
        current={profile.region || ""}
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
    /* "Not set" rather than a dash — a missing region means no Regional
       leaderboard at all, which is worth prompting rather than shrugging at */
    { anim: "region", label: "Region", value: profile.region || "Not set", note: "leaderboards", to: "region" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.page}>
        <BackRow title="Profile" onBack={onBack} />

        <View style={s.headWrap}>
          <Avatar size={72} badge accent={accent} onPress={() => { H.tap(); setPhotoOpen(true); }} />

          {/* the upload, said out loud. It's a second or two on a good
              connection and much longer on a bad one. */}
          {uploading && (
            <View style={s.uploadRow}>
              <ActivityIndicator size="small" color={T.green} />
              <Text style={s.uploadText}>Saving your photo…</Text>
            </View>
          )}

          {photoErr && !uploading && (
            <View style={s.photoErrRow}>
              <AlertTriangle size={13} color={T.gold} />
              <Text style={s.photoErrText}>{photoErr}</Text>
            </View>
          )}

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
              {i > 0 && <View style={s.rowDivider} />}
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

      {/* the chooser. It closes itself before calling any of these, which is
          what keeps the camera from opening on top of it — two modals at once
          leaves iOS half-presenting the second, and the invisible one swallows
          every tap on the screen behind. */}
      <PhotoSheet
        visible={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onTakePhoto={() => setCamOpen(true)}
        /* the library goes through the SAME camera widget, which already knows
           how to open the picker — a second copy of that code here would be
           two places to fix when the picker API next changes */
        onPickLibrary={() => setCamOpen(true)}
        onRemove={removePhoto}
      />

      <CameraSheet
        visible={camOpen}
        caption="Take a photo"
        /* the tall one, front-facing — your face in frame, shutter in reach */
        anchor="top"
        startFacing="front"
        onClose={() => setCamOpen(false)}
        onCapture={saveNewPhoto}
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

    uploadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    uploadText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    photoErrRow: {
      flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 11,
    },
    photoErrText: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },

    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    rowDivider: { height: 1, backgroundColor: T.border, marginLeft: 56 },
    /* the plain rule between the two halves of the password form */
    divider: { height: 1, backgroundColor: T.border, marginTop: 20 },

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

    primaryBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { fontSize: 14.5, color: T.ink, fontFamily: FONTS.headingMed },
    btnDisabled: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    /* the email-sent state */
    sentWrap: { alignItems: "center", paddingHorizontal: 8, paddingTop: 20 },
    sentIcon: {
      width: 62, height: 62, borderRadius: 20,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center", marginBottom: 18,
    },
    sentTitle: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginBottom: 8 },
    sentBody: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19.5 },
    sentNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 18,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 13, padding: 13,
    },
    sentNoteText: { flex: 1, fontSize: 12, color: "#FBBF24", fontFamily: FONTS.body, lineHeight: 17.5 },

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