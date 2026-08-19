// app/signin.tsx
// The sign-in screen. Reachable from two places: the "Sign in" link on
// onboarding's welcome, and after logging out of Profile.
//
// Logging out lands HERE rather than back at onboarding — someone with an
// account shouldn't have to answer thirty questions again to get back in.
import { useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "../components/Icon";
import { IsoMGlow } from "../components/IsoM";
import { useApp } from "../constants/AppState";
import { signIn as authSignIn, sendReset } from "../constants/auth";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";

/* These have to be real hosted pages before launch — App Store review checks
   the links resolve. They're a website job, not an app screen. */
const TERMS_URL = "https://motion.app/terms";
const PRIVACY_URL = "https://motion.app/privacy";

export default function SignIn() {
  const router = useRouter();
  /* the theme comes from AppState, so sign-in wears whatever the user left in.
     It only survives a RESTART once the profile is loaded from the backend —
     until then a cold start falls back to dark. */
  const { T, setIsPro } = useApp();
  const s = styles(T);

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);

  /* null while the form is up; a label while a request is in flight */
  const [busy, setBusy] = useState<string | null>(null);
  /* the last thing that went wrong, in words a user can act on */
  const [err, setErr] = useState<string | null>(null);

  const ready = email.trim().length > 3 && pw.length >= 6;

  /* typing anywhere clears the error — leaving a stale "wrong password" up
     while someone corrects it is just noise */
  const onEmail = (t: string) => { setEmail(t); setSent(false); setErr(null); };
  const onPw = (t: string) => { setPw(t); setErr(null); };

  const submit = async () => {
    if (!ready || busy) return;
    H.tap();
    setErr(null);
    setBusy("Signing you in…");

    const { error } = await authSignIn(email, pw);

    if (error) {
      /* back to the form with the reason. The failure has to be recoverable
         in place — bouncing to another screen loses what they typed. */
      setBusy(null);
      setErr(error);
      H.warn();
      return;
    }

    H.success();
    setIsPro(false);
    router.replace("/(tabs)");
  };

  /* Apple and Google need native SDK setup and a development build — neither
     works in Expo Go. Wired at the same time as the dev build. */
  const social = (provider: "Apple" | "Google") => {
    H.tap();
    setErr(`${provider} sign-in isn't wired yet — use your email and password for now.`);
  };

  const forgot = async () => {
    if (email.trim().length < 4 || busy) return;
    H.tap();
    const { error } = await sendReset(email);
    if (error) { setErr(error); return; }
    setSent(true);
  };

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  /* ---------- the loading state ----------
     The same rainbow M the app uses everywhere it's working. It takes over
     the whole screen so there's nothing to tap mid-request. */
  if (busy) {
    return (
      <View style={[s.screen, s.loadWrap]}>
        <IsoMGlow size={104} />
        <Text style={s.loadText}>{busy}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <IsoMGlow size={92} />
        </View>

        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub}>Sign in and your plan, streak and history pick up exactly where you left them.</Text>

        <View style={{ marginTop: 26, gap: 10 }}>
          {/* the DARK Apple mark — this button is white, and the standard
              near-white logo all but disappears on it */}
          <Pressable onPress={() => social("Apple")} style={[s.authBtn, { backgroundColor: "#FFFFFF" }]}>
            <Icon name="appleDark" size={20} mode="loop" />
            <Text style={[s.authText, { color: "#0A0A0A" }]}>Continue with Apple</Text>
          </Pressable>

          <Pressable onPress={() => social("Google")} style={[s.authBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}>
            <Icon name="google" size={19} mode="loop" />
            <Text style={[s.authText, { color: T.text }]}>Continue with Google</Text>
          </Pressable>
        </View>

        <View style={s.orRow}>
          <View style={s.orLine} />
          <Text style={s.orText}>or</Text>
          <View style={s.orLine} />
        </View>

        <View style={[s.field, err && s.fieldBad]}>
          <Icon name="email" size={18} mode="loop" />
          <TextInput
            value={email}
            onChangeText={onEmail}
            placeholder="name@email.com"
            placeholderTextColor={T.micro}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
        </View>

        <View style={[s.field, { marginTop: 10 }, err && s.fieldBad]}>
          <Icon name="password" size={18} mode="loop" />
          <TextInput
            value={pw}
            onChangeText={onPw}
            placeholder="Your password"
            placeholderTextColor={T.micro}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
            onSubmitEditing={submit}
          />
          <Pressable onPress={() => setShow((x) => !x)} hitSlop={10}>
            {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
          </Pressable>
        </View>

        {err ? (
          <View style={s.errRow}>
            <AlertTriangle size={14} color={T.red} />
            <Text style={s.errText}>{err}</Text>
          </View>
        ) : null}

        {/* the reset needs an email first — asking for one after the tap is a
            wasted round trip */}
        <Pressable onPress={forgot} style={s.forgotRow} hitSlop={8}>
          {sent ? (
            <View style={s.sentRow}>
              <Check size={13} color={T.green} />
              <Text style={s.sentText}>Reset link sent to {email.trim()}</Text>
            </View>
          ) : (
            <Text style={[s.forgot, email.trim().length < 4 && { color: T.micro }]}>
              Forgot your password?
            </Text>
          )}
        </Pressable>

        <Pressable onPress={submit} style={[s.primaryBtn, !ready && s.btnOff]}>
          <Text style={[s.primaryBtnText, !ready && { color: T.micro }]}>Sign in</Text>
        </Pressable>

        <Pressable onPress={() => { H.tap(); router.replace("/onboarding"); }} style={s.createRow} hitSlop={8}>
          <Text style={s.createText}>
            New here? <Text style={{ color: T.green }}>Create an account</Text>
          </Text>
        </Pressable>

        <Text style={s.legal}>
          By continuing you agree to MOTION's{" "}
          <Text style={s.legalLink} onPress={() => open(TERMS_URL)}>Terms</Text>
          {" "}and{" "}
          <Text style={s.legalLink} onPress={() => open(PRIVACY_URL)}>Privacy Policy</Text>.
        </Text>

        {/* ---------- DEV ONLY ----------
            A way back into onboarding without wiping anything, so the flow can
            be walked repeatedly during development. Marked loudly and removed
            before launch — a real user should never find a door back into
            signup from the sign-in screen. */}
        <Pressable onPress={() => { H.tick(); router.replace("/onboarding"); }} style={s.devBtn}>
          <ArrowLeft size={13} color={T.sub} />
          <Text style={s.devText}>DEV · run onboarding again</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    body: { padding: 24, paddingTop: 76, paddingBottom: 44 },

    loadWrap: { alignItems: "center", justifyContent: "center", gap: 22 },
    loadText: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, letterSpacing: 0.6 },

    title: { fontSize: 27, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginTop: 10 },
    sub: { fontSize: 13.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 8 },

    authBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 15 },
    authText: { fontSize: 14.5, fontFamily: FONTS.headingMed },

    orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22, marginBottom: 22 },
    orLine: { flex: 1, height: 1, backgroundColor: T.border },
    orText: { fontSize: 12, color: T.micro, fontFamily: FONTS.body },

    field: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    },
    fieldBad: { borderColor: "rgba(239,68,68,0.5)" },
    input: { flex: 1, color: T.text, fontFamily: FONTS.body, fontSize: 14.5, padding: 0 },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    forgotRow: { alignSelf: "flex-end", marginTop: 12, marginBottom: 20 },
    forgot: { fontSize: 12.5, color: T.green, fontFamily: FONTS.headingMed },
    sentRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    sentText: { fontSize: 12, color: T.green, fontFamily: FONTS.body },

    primaryBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    btnOff: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    primaryBtnText: { color: "#0A0A0A", fontFamily: FONTS.heading, fontSize: 15 },

    createRow: { alignItems: "center", marginTop: 18 },
    createText: { fontSize: 13.5, color: T.sub, fontFamily: FONTS.body },

    legal: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 22, lineHeight: 17 },
    legalLink: { color: T.sub, textDecorationLine: "underline" },

    devBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
      alignSelf: "center", marginTop: 30,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9,
    },
    devText: { fontSize: 10, color: T.sub, fontFamily: FONTS.body, letterSpacing: 0.6 },
  });