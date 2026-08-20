// app/(tabs)/camera.tsx
// The logging hub — four ways in, the capture widgets, and the flows behind them.
//
// FOUR PATHS, and they differ in what KIND of claim they produce:
//
//   BARCODE  → the manufacturer's own figures, exact off a label
//   SEARCH   → a database entry, exact per gram, portion estimated
//   PHOTO    → MOTION's estimate of a plate, honestly around ±25%
//   VOICE    → the same estimate, from a description instead
//
// That difference is why they have separate result screens rather than one
// shared one. A screen that showed a photo guess the same way it shows a label
// reading would be quietly lying about which numbers can be trusted.
//
// PHOTO AND VOICE SHARE A RESULT SCREEN, though, because they're the same kind
// of claim arriving by different doors — both produce a list of estimated
// items that the person can correct.
//
// ⚠️ VOICE IS COMMENTED OUT. expo-speech-recognition is a NATIVE module and
// three separate dev builds have failed to compile it in, all throwing
// "Cannot find native module 'ExpoSpeechRecognition'" at load time — which
// kills this ENTIRE TAB, not just the voice feature, because the import runs
// before anything renders.
//
// Ruled out so far: the package IS installed (npm ls confirms 56.0.1), it IS
// in package.json dependencies, the plugin IS in app.json, and the lock file
// has been committed. The remaining suspect is the PREBUILD phase of the EAS
// build, where config plugins get applied — that log hasn't been read yet.
//
// Everything below the voice lines works. Uncomment the two marked spots once
// a build lands with the module actually in it.
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ChevronDown, ChevronRight, Crown, RefreshCw, ScanLine, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BarcodeResult from "../../components/BarcodeResult";
import CameraSheet from "../../components/CameraSheet";
import Icon, { IconName } from "../../components/Icon";
import IsoM, { IsoMGlow } from "../../components/IsoM";
import MealPicker from "../../components/MealPicker";
import MealResult from "../../components/MealResult";
import NoPhotoFlow from "../../components/NoPhotoFlow";
import Tap from "../../components/Tap";
// ⚠️ UNCOMMENT WITH THE BLOCK NEAR THE BOTTOM
// import VoiceCapture from "../../components/VoiceCapture";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";
import { MealItem, readMealPhoto } from "../../constants/mealPhoto";
import { readMealDescription } from "../../constants/mealVoice";
import { FONTS, tierForStreak } from "../../constants/theme";

type Stage =
  | "hub" | "camera" | "barcodecam" | "barcoderesult"
  | "voice" | "reading" | "mealresult" | "failed"
  | "search";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export default function CameraScreen() {
  const router = useRouter();
  const { T, freeLocked, streakDays, tabResetKey, openPaywall } = useApp();
  const s = styles(T);

  /* WHICH MEAL. Home sends this when you tap a specific row — "Add snack" has
     to open the camera set to Snacks, not to whatever was picked last time.
     Without it, tapping Add snack and logging filed the food under Dinner:
     the user thought they logged one thing and the app logged another, which
     is the worst kind of bug because nothing looks wrong until later. */
  const params = useLocalSearchParams<{ meal?: string }>();
  const [meal, setMeal] = useState("Breakfast");

  const [stage, setStage] = useState<Stage>("hub");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [snapSpent, setSnapSpent] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  /* what the estimate produced, whichever door it came through */
  const [items, setItems] = useState<MealItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  /* which door — so the failure screen offers the right way back in */
  const [came, setCame] = useState<"photo" | "voice">("photo");

  const tier = tierForStreak(streakDays);
  const markColor = freeLocked ? T.green : tier.color;

  useEffect(() => {
    const incoming = params.meal;
    if (typeof incoming === "string" && MEALS.includes(incoming)) {
      setMeal(incoming);
    }
  }, [params.meal]);

  /* tapping the tab while already here closes whatever's open */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setStage("hub");
    setPickerOpen(false);
  }, [tabResetKey]);

  /* leaving a flow clears what it was carrying — a stale photo or barcode
     would attach the wrong picture, or the wrong product, to the next meal */
  const backToHub = () => {
    setPhotoUri(null);
    setScannedCode(null);
    setItems([]);
    setSummary(null);
    setProblem(null);
    setStage("hub");
  };

  /* ---------- THE PHOTO PATH ----------
     A plate of food has no printed numbers, so this is genuine estimation —
     the model identifies what it can see and guesses at volumes it can't. */
  const captured = async (uri?: string) => {
    if (freeLocked) setSnapSpent(true);

    if (!uri) {
      setCame("photo");
      setProblem("That photo didn't come through.");
      setStage("failed");
      return;
    }

    setCame("photo");
    setPhotoUri(uri);
    setProgress(null);
    setProblem(null);
    setStage("reading");

    let b64: string;
    try {
      /* BIGGER THAN A LABEL PHOTO, deliberately. A nutrition panel is
         high-contrast print that survives heavy compression; a plate of food
         is texture and shadow, and judging portion size needs detail that a
         hard squeeze throws away. */
      const ctx = ImageManipulator.manipulate(uri).resize({ width: 1200 });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
      b64 = await FileSystem.readAsStringAsync(out.uri, { encoding: "base64" });

      console.log("MEAL: sending ≈", Math.round(b64.length * 0.75 / 1024), "KB");
    } catch (e: any) {
      console.log("MEAL: image prep failed →", e?.message || e);
      setProblem("Couldn't process that photo on this phone. Try taking it again.");
      setStage("failed");
      return;
    }

    const r = await readMealPhoto(b64, setProgress);
    setProgress(null);

    if (!r.confident || !r.items.length) {
      setProblem(r.problem || "MOTION couldn't make out what's on the plate.");
      setStage("failed");
      H.warn();
      return;
    }

    setItems(r.items);
    setSummary(r.summary);
    H.success();
    setStage("mealresult");
  };

  /* ---------- THE VOICE PATH ----------
     Same estimation problem as the photo, minus the picture — which arguably
     makes it harder, since a photo at least shows how much is on the plate.

     This function is live and correct; only the CAPTURE screen is commented
     out below, because that's what imports the native module. */
  const heard = async (transcript: string) => {
    setCame("voice");
    setPhotoUri(null);
    setProgress(null);
    setProblem(null);
    setStage("reading");

    const r = await readMealDescription(transcript, setProgress);
    setProgress(null);

    if (!r.confident || !r.items.length) {
      setProblem(r.problem || "MOTION didn't catch any food in that.");
      setStage("failed");
      H.warn();
      return;
    }

    setItems(r.items);
    setSummary(r.summary);
    H.success();
    setStage("mealresult");
  };

  /* ---------- the flows own the screen once they start ---------- */

  if (stage === "reading") {
    return (
      <View style={s.busy}>
        <IsoMGlow size={100} />
        <Text style={s.busyTitle}>
          {came === "voice" ? "Working out what you ate…" : "Working out what's on the plate…"}
        </Text>
        <Text style={s.busySub}>{progress || "A few seconds"}</Text>
      </View>
    );
  }

  if (stage === "mealresult") {
    return (
      <View style={s.screen}>
        <MealResult
          meal={meal}
          photoUri={photoUri}
          items={items}
          summary={summary}
          onExit={backToHub}
          onRetake={() => {
            setItems([]);
            setSummary(null);
            setStage(came === "voice" ? "voice" : "camera");
          }}
        />
      </View>
    );
  }

  /* ---------- IT DIDN'T WORK ----------
     Never a dead end. Every other way in is offered, and the wording avoids
     blaming the user — some plates genuinely can't be read, and a barcode or
     a search is often the better answer anyway. */
  if (stage === "failed") {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
          <View style={s.failHead}>
            <Pressable onPress={backToHub} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
              <X size={22} color={T.text} />
            </Pressable>
            <Text style={s.micro}>Log {meal.toLowerCase()}</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={s.failWrap}>
            <View style={s.failIcon}>
              <AlertTriangle size={26} color={T.gold} />
            </View>

            <Text style={s.failTitle}>Couldn't read that one</Text>
            <Text style={s.failBody}>
              {problem}
              {"\n\n"}
              Rather than guess at numbers going into your diary, MOTION would rather ask again.
            </Text>

            <Tap onPress={() => { H.tap(); setStage("camera"); }} style={{ width: "100%", marginTop: 20 }}>
              <View style={s.failPrimary}>
                <RefreshCw size={15} color={T.ink} />
                <Text style={s.failPrimaryText}>Take another photo</Text>
              </View>
            </Tap>

            <Text style={s.failOr}>or</Text>

            <Tap onPress={() => { H.tap(); setStage("search"); }} style={{ width: "100%" }}>
              <View style={s.failGhost}>
                <Text style={s.failGhostText}>Search for it by name</Text>
              </View>
            </Tap>

            {!freeLocked && (
              <Tap onPress={() => { H.tap(); setStage("barcodecam"); }} style={{ width: "100%", marginTop: 10 }}>
                <View style={s.failGhost}>
                  <ScanLine size={15} color={T.sub} />
                  <Text style={s.failGhostText}>Scan a barcode, if it came in a packet</Text>
                </View>
              </Tap>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (stage === "barcoderesult") {
    return (
      <View style={s.screen}>
        <BarcodeResult
          meal={meal}
          code={scannedCode}
          onExit={backToHub}
          onRescan={() => { setScannedCode(null); setStage("barcodecam"); }}
        />
      </View>
    );
  }

  if (stage === "search") {
    return (
      <View style={s.screen}>
        {/* the manual builder, opened straight into the search — you already
            know what you ate, so an empty plate first is a wasted step */}
        <NoPhotoFlow
          meal={meal}
          onExit={backToHub}
          onVoice={() => setStage("voice")}
          searchMode
          autoOpen
        />
      </View>
    );
  }

  const options: {
    key: string;
    icon: IconName;
    title: string;
    desc: string;
    tag: string;
    pro: boolean;
    onPress: () => void;
  }[] = [
    {
      key: "snap",
      icon: "camera",
      title: "Snap a meal",
      desc: "Take a photo — MOTION AI estimates it.",
      tag: "AI",
      pro: false,
      onPress: () => setStage("camera"),
    },
    {
      key: "voice",
      icon: "logPen",
      /* "Log without a photo" was too vague — it read as though it covered
         packets and products too, when it's specifically for a meal you're
         describing rather than photographing */
      title: "Describe a meal",
      desc: "Say what you ate — no typing.",
      tag: "AI",
      pro: false,
      onPress: () => setStage("voice"),
    },
    {
      key: "barcode",
      icon: "barcode",
      title: "Scan barcode",
      desc: "Exact facts for packaged food.",
      tag: "Exact",
      pro: true,
      /* the crown on this card says it's Pro, so tapping it on free has to
         land on the paywall. Letting it through made the lock decorative —
         and a lock that doesn't lock teaches people to ignore every other
         one in the app. */
      onPress: () => (freeLocked ? openPaywall("subscribe") : setStage("barcodecam")),
    },
    {
      key: "search",
      icon: "search",
      title: "Search food",
      desc: "Find the exact food + portion.",
      tag: "Exact",
      pro: false,
      onPress: () => setStage("search"),
    },
  ];

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
        {/* the title IS the meal switcher — the meal you're adding to has to be
            the most obvious thing on the screen */}
        <View style={s.header}>
          <View style={{ width: 42 }}>
            <IsoM size={30} color={markColor} />
          </View>

          <Tap onPress={() => { H.tap(); setPickerOpen(true); }} style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={s.title}>LOG {meal.toUpperCase()}</Text>
              <ChevronDown size={17} color={T.green} />
            </View>
          </Tap>

          <Pressable onPress={() => router.push("/(tabs)")} hitSlop={10} style={s.closeBtn}>
            <X size={22} color={T.sub} />
          </Pressable>
        </View>

        <Text style={s.subtitle}>Tap the title to log a different meal</Text>

        {options.map((o) => (
          <Tap key={o.key} onPress={() => { H.tap(); o.onPress(); }} style={{ marginBottom: 12 }}>
            <View style={s.card}>
              <View style={s.cardIcon}>
                <Icon name={o.icon} size={26} mode="loop" />
                {o.pro && freeLocked && (
                  <View style={s.proCrown}>
                    <Crown size={9} color="#0A0A0A" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>{o.title}</Text>
                  <View style={s.tag}>
                    <Text style={s.tagText}>{o.tag}</Text>
                  </View>
                </View>
                <Text style={s.cardDesc}>{o.desc}</Text>
              </View>

              <ChevronRight size={20} color={T.micro} />
            </View>
          </Tap>
        ))}

        <Text style={s.foot}>Every option works — try each one.</Text>
      </ScrollView>

      <MealPicker
        visible={pickerOpen}
        meal={meal}
        onPick={(m) => { setMeal(m); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />

      {/* photo capture — the gold "1 photo left" bar shows BEFORE the shot is
          spent, the blurred lock shows after */}
      <CameraSheet
        visible={stage === "camera"}
        mode="photo"
        locked={freeLocked && snapSpent}
        showFreeBar={freeLocked && !snapSpent}
        onClose={backToHub}
        onCapture={captured}
      />

      {/* the scanner finds the code itself and hands up the digits — no
          button, because pointing at a barcode IS the interaction */}
      <CameraSheet
        visible={stage === "barcodecam"}
        mode="barcode"
        onClose={backToHub}
        onCapture={() => {}}
        onBarcode={(code) => { setScannedCode(code); setStage("barcoderesult"); }}
      />

      {/* ⚠️ UNCOMMENT WITH THE IMPORT AT THE TOP, once a dev build actually
          contains the speech module.

      <VoiceCapture
        visible={stage === "voice"}
        meal={meal}
        onClose={backToHub}
        onTranscript={heard}
      />
      */}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    busy: {
      flex: 1, backgroundColor: T.bg,
      alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40,
    },
    busyTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, textAlign: "center" },
    busySub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 17 },

    header: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
    title: { fontSize: 18, letterSpacing: 0.7, color: T.text, fontFamily: FONTS.heading },
    closeBtn: { width: 42, alignItems: "flex-end", padding: 4 },
    subtitle: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginBottom: 22 },

    card: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 18, padding: 16,
    },
    cardIcon: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    proCrown: {
      position: "absolute", top: -5, right: -5,
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: T.gold, alignItems: "center", justifyContent: "center",
      borderWidth: 1.5, borderColor: T.card,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed },
    tag: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    tagText: { fontSize: 9, color: T.sub, fontFamily: FONTS.body },
    cardDesc: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4 },

    foot: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14 },

    /* it didn't work */
    failHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    failWrap: { alignItems: "center", paddingTop: 24, gap: 10 },
    failIcon: {
      width: 58, height: 58, borderRadius: 19,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: `${T.gold}55`,
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    failTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    failBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18.5 },
    failOr: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginVertical: 4 },
    failPrimary: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.green, borderRadius: 14, paddingVertical: 15,
    },
    failPrimaryText: { fontSize: 14.5, color: T.ink, fontFamily: FONTS.headingMed },
    failGhost: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14,
    },
    failGhostText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });