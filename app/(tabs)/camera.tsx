// app/(tabs)/camera.tsx
// The logging hub — four ways in, the capture widget, and the flows behind them.
//
// All four work: snap → result, barcode → product, search, and
// log-without-photo. Search and no-photo share one builder; barcode and snap
// have their own result screens because their data is different in kind
// (exact from a label, vs estimated from a photo).
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, Crown, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BarcodeResult from "../../components/BarcodeResult";
import CameraSheet from "../../components/CameraSheet";
import Icon, { IconName } from "../../components/Icon";
import IsoM from "../../components/IsoM";
import MealPicker from "../../components/MealPicker";
import NoPhotoFlow from "../../components/NoPhotoFlow";
import ResultFlow, { ResultStage } from "../../components/ResultFlow";
import Tap from "../../components/Tap";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";
import { FONTS, tierForStreak } from "../../constants/theme";

type Stage =
  | "hub" | "camera" | "barcodecam" | "barcoderesult"
  | "result" | "nophoto" | "search";

export default function CameraScreen() {
  const router = useRouter();
  const { T, freeLocked, streakDays, tabResetKey, openPaywall } = useApp();
  const s = styles(T);

  const [meal, setMeal] = useState("Breakfast");
  const [stage, setStage] = useState<Stage>("hub");
  const [resultStage, setResultStage] = useState<ResultStage>("analysing");
  const [pickerOpen, setPickerOpen] = useState(false);
  // a free user gets one photo a day; once spent the preview locks
  const [snapSpent, setSnapSpent] = useState(false);

  const tier = tierForStreak(streakDays);
  const markColor = freeLocked ? T.green : tier.color;

  /* tapping the tab while already here closes whatever's open */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setStage("hub");
    setPickerOpen(false);
  }, [tabResetKey]);

  const backToHub = () => setStage("hub");

  /* the shutter fired — go straight into analysing */
  const captured = () => {
    if (freeLocked) setSnapSpent(true);
    setResultStage("analysing");
    setStage("result");
  };

  /* describing a meal out loud hands over to the result flow's voice step,
     which then estimates the whole meal from the description */
  const toVoice = () => { setResultStage("voice"); setStage("result"); };

  /* ---------- the flows own the screen once they start ---------- */
  if (stage === "result") {
    return (
      <View style={s.screen}>
        <ResultFlow
          meal={meal}
          stage={resultStage}
          setStage={setResultStage}
          onExit={backToHub}
          onRetake={() => setStage("camera")}
        />
      </View>
    );
  }

  if (stage === "barcoderesult") {
    return (
      <View style={s.screen}>
        <BarcodeResult
          meal={meal}
          onExit={backToHub}
          onRescan={() => setStage("barcodecam")}
        />
      </View>
    );
  }

  if (stage === "nophoto") {
    return (
      <View style={s.screen}>
        <NoPhotoFlow meal={meal} onExit={backToHub} onVoice={toVoice} />
      </View>
    );
  }

  if (stage === "search") {
    return (
      <View style={s.screen}>
        {/* same builder, but it opens straight into the search — you already
            know what you ate, so an empty plate first is a wasted step */}
        <NoPhotoFlow meal={meal} onExit={backToHub} onVoice={toVoice} searchMode autoOpen />
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
      key: "nophoto",
      icon: "logPen",
      title: "Log without a photo",
      desc: "Forgot to snap it? We'll estimate it.",
      tag: "AI",
      pro: false,
      onPress: () => setStage("nophoto"),
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

      {/* barcode finds the code on its own, then lands on the product */}
      <CameraSheet
        visible={stage === "barcodecam"}
        mode="barcode"
        onClose={backToHub}
        onCapture={() => setStage("barcoderesult")}
      />
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

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
  });