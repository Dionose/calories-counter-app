// app/signin.tsx
// The sign-in screen. Reachable from two places: the "Sign in" link on
// onboarding's welcome, and after logging out of Profile.
//
// Logging out lands HERE rather than back at onboarding — someone with an
// account shouldn't have to answer thirty questions again to get back in.
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "../components/Icon";
import { IsoMGlow } from "../components/IsoM";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { supabase } from "../constants/supabase";
import { FONTS } from "../constants/theme";

/* These have to be real hosted pages before launch — App Store review checks
   the links resolve. They're a website job, not an app screen. */
const TERMS_URL = "https://motion.app/terms";
const PRIVACY_URL = "https://motion.app/privacy";

/* How long the loading screen holds. Once Supabase auth lands this becomes
   the real round trip and the timer goes away — the SHAPE stays the same, so
   swapping in the live call is a one-function change. */
const AUTH_MS = 1600;

export default function SignIn() {
  const router = useRouter();
  /* the theme comes from AppState, so sign-in wears whatever the user left in.
     It only survives a RESTART once AsyncStorage lands — until then a cold
     start falls back to dark. */
  const { T, setIsPro } = useApp();
  const s = styles(T);

  /* ---------- TEMPORARY CONNECTION TEST ----------
     A real round trip to Supabase, so we know the whole chain works — env
     vars, client, network, table, security policies — before building
     anything on top of it. Zero rows is the correct result; the table is
     empty. DELETE this block once auth is actually wired. */
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id")
      .then(({ error }) => {
        console.log(
          error
            ? "SUPABASE ERROR: " + error.message
            : "SUPABASE OK — reached profiles"
        );
      });
  }, []);

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);

  /* null while the form is up; a label while signing in. Signing in is a
     network round trip, so it has to LOOK like one — dropping straight into
     the app makes a real 2-second wait feel like a freeze later. */
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const ready = email.trim().length > 3 && pw.length >= 6;

  /* the one place that enters the app. When Supabase auth lands, the timeout
     becomes `await signInWithPassword(...)` and everything else stays. */
  const authenticate = (label: string) => {
    setBusy(label);
    timer.current = setTimeout(() => {
      setIsPro(false);
      router.replace("/(tabs)");
    }, AUTH_MS);
  };

  const signIn = () => {
    if (!ready) return;
    H.success();
    authenticate("Signing you in…");
  };

  const social = (provider: "Apple" | "Google") => {
    H.tap();
    authenticate(`Signing in with ${provider}…`);
  };

  const forgot = () => {
    if (email.trim().length < 4) return;
    H.tap();
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

        <View style={s.field}>
          <Icon name="email" size={18} mode="loop" />
          <TextInput
            value={email}
            onChangeText={(t) => { setEmail(t); setSent(false); }}
            placeholder="name@email.com"
            placeholderTextColor={T.micro}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
        </View>

        <View style={[s.field, { marginTop: 10 }]}>
          <Icon name="password" size={18} mode="loop" />
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="Your password"
            placeholderTextColor={T.micro}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          <Pressable onPress={() => setShow((x) => !x)} hitSlop={10}>
            {show ? <EyeOff size={17} color={T.sub} /> : <Eye size={17} color={T.sub} />}
          </Pressable>
        </View>

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

        <Pressable onPress={signIn} style={[s.primaryBtn, !ready && s.btnOff]}>
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
    input: { flex: 1, color: T.text, fontFamily: FONTS.body, fontSize: 14.5, padding: 0 },

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