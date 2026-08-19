// components/CameraSheet.tsx
// The capture widget. NOT a full screen — a card that rises over whatever
// screen opened it, sitting ~20% up from the bottom with the hub still visible
// behind. Used everywhere in the app that needs a camera: meal logging,
// barcode scanning, and the profile photo.
//
// TWO WAYS IN, and only one of them works today:
//
//   THE GALLERY BUTTON is real. expo-image-picker runs inside Expo Go, so
//   choosing an existing photo produces a genuine file URI that flows all the
//   way through to Supabase Storage. It's also a feature people actually
//   want — "log the photo I already took" — not just a testing crutch.
//
//   THE SHUTTER is still a placeholder. expo-camera needs a development build,
//   so <Preview /> draws a gradient and the shutter fires onCapture with no
//   URI. When the dev build lands, only <Preview /> and shoot() change; the
//   rest of this file, and everything downstream, already handles a real URI.
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Lock, RefreshCw, X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

const { height: SCREEN_H } = Dimensions.get("window");
const PREVIEW_H = 300;
const BARCODE_MS = 2600;   // how long the scanner "looks" before it finds a code

/* ---------- the placeholder preview ----------
   Swap this one component for <CameraView> once there's a dev build. It fills
   the same 300px box, so the shutter, frames and overlays all stay put. */
function Preview({ barcode }: { barcode: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["#1E1A16", "#0B0A09"]} style={StyleSheet.absoluteFill} />
      <View style={s0.previewCentre}>
        <Camera size={38} color="rgba(255,255,255,0.35)" />
        <Text style={s0.previewText}>
          {barcode
            ? "Camera preview needs a development build — the scanner will find the code on its own."
            : "Camera preview needs a development build. Tap the gallery icon to pick a real photo, or the shutter to simulate."}
        </Text>
      </View>
    </View>
  );
}

/* ---------- the shutter ----------
   A SQUIRCLE, not a circle: a thin green rim hugging a pearlescent lens, with
   a black gap between them. The rim blinks on and off rather than glowing —
   it's a rim light, so it stays tight to the shape at all times. */
function Shutter({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // the rim fades in and out — no scaling, so it never drifts off the edge
  const rimOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  // a second rim just outside, barely there, to suggest the light spilling
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Pressable onPress={onPress}>
      <View style={s0.shutterWrap}>
        {/* the faint outer rim — the spill */}
        <Animated.View style={[s0.shutterHalo, { opacity: haloOpacity }]} pointerEvents="none" />

        {/* the green rim itself */}
        <Animated.View style={[s0.shutterRim, { opacity: rimOpacity }]}>
          <LinearGradient
            colors={["#4ADE80", "#22C55E", "#16A34A", "#22C55E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s0.rimFill}
          />
        </Animated.View>

        {/* the black gap */}
        <View style={s0.shutterGap}>
          {/* the lens — pearlescent, highlight up-left */}
          <LinearGradient
            colors={["#FFFFFF", "#E8E8E8", "#C7C7C7"]}
            start={{ x: 0.25, y: 0.15 }}
            end={{ x: 0.85, y: 1 }}
            style={s0.lens}
          />
          {/* faked inset shading: light along the top, shadow along the bottom */}
          <View style={s0.lensTopSheen} pointerEvents="none" />
          <View style={s0.lensBottomShade} pointerEvents="none" />
        </View>
      </View>
    </Pressable>
  );
}

/* ---------- the barcode scan line ---------- */
function ScanLine({ T }: { T: any }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [6, 122] });

  return (
    <Animated.View
      style={{
        position: "absolute", left: 10, right: 10, height: 2,
        backgroundColor: T.green, borderRadius: 2,
        shadowColor: T.green, shadowOpacity: 1, shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        transform: [{ translateY }],
      }}
    />
  );
}

/* ---------- the pulsing "scanning" dot ---------- */
function RecDot({ T }: { T: any }) {
  const o = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green, opacity: o }} />;
}

export default function CameraSheet({
  visible, mode = "photo", caption, locked, showFreeBar, onClose, onCapture,
}: {
  visible: boolean;
  mode?: "photo" | "barcode";
  /** overrides the default header text — "Take a photo" for the profile avatar */
  caption?: string;
  /** free user who's already spent today's photo — preview blurs, controls go gold */
  locked?: boolean;
  /** the amber "1 photo left" bar, shown to free users BEFORE they shoot */
  showFreeBar?: boolean;
  onClose: () => void;
  /** carries the picked image's URI when there is one. The simulated shutter
      calls it with nothing, which downstream treats as "no photo". */
  onCapture: (uri?: string) => void;
}) {
  const { T, openPaywall } = useApp();
  const s = styles(T);
  const barcode = mode === "barcode";

  const rise = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, {
      toValue: visible ? 1 : 0,
      duration: visible ? 460 : 200,
      easing: visible ? Easing.bezier(0.2, 0.9, 0.25, 1) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  /* barcode has no button — it finds the code on its own after a beat */
  useEffect(() => {
    if (!visible || !barcode || locked) return;
    const t = setTimeout(() => { H.success(); onCapture(); }, BARCODE_MS);
    return () => clearTimeout(t);
  }, [visible, barcode, locked]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.5, 0] });
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  /* the SIMULATED shutter — no URI, because there's no camera yet */
  const shoot = () => {
    H.tap();
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onCapture());
  };

  /* THE REAL ONE. Works today, in Expo Go, and produces a genuine file URI.
     Permission is requested at the moment of use rather than on mount —
     asking for library access before the user has shown any interest in
     using it is how apps get denied on the first prompt. */
  const pickFromGallery = async () => {
    H.tap();

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      /* no cropping. A meal photo shouldn't be squared off — the AI wants the
         whole plate, and forcing a crop can cut food out of the frame. */
      allowsEditing: false,
      /* full quality here; photos.ts resizes and compresses on the way up, and
         degrading it twice would cost detail for nothing. */
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    H.success();
    onCapture(result.assets[0].uri);
  };

  const goPro = () => {
    H.tap();
    onClose();
    setTimeout(() => openPaywall("subscribe"), 240);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[s.widgetWrap, { opacity: rise, transform: [{ translateY }, { scale }] }]}>
          <TravelBorder color={T.green} cardBg="#000000" borderColor={T.border} radius={26} strokeWidth={2.5}>
            <View style={s.inner}>

              {/* header */}
              <View style={s.head}>
                <Text style={s.headText}>
                  {caption || (barcode ? "Scan a barcode" : "Snap your meal")}
                </Text>
                <Pressable onPress={onClose} hitSlop={10} style={s.headClose}>
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* the free-plan warning, before the shot is spent */}
              {showFreeBar && !locked && !barcode && (
                <Pressable onPress={goPro} style={s.freeBar}>
                  <Lock size={13} color={T.gold} />
                  <Text style={s.freeBarText}>1 photo left today on the free plan — make it count.</Text>
                  <Text style={s.freeBarCta}>Upgrade →</Text>
                </Pressable>
              )}

              {/* the preview */}
              <View style={s.preview}>
                <Preview barcode={barcode} />

                {barcode && !locked && (
                  <View style={s.barcodeOverlay} pointerEvents="none">
                    <Text style={s.barcodeHint}>Point at the barcode</Text>
                    <View style={s.barcodeFrame}>
                      <ScanLine T={T} />
                    </View>
                  </View>
                )}

                {/* spent — blur the preview and explain */}
                {locked && (
                  <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, s.lockWrap]}>
                    <View style={s.lockIcon}>
                      <Lock size={22} color="#0A0A0A" />
                    </View>
                    <Text style={s.lockTitle}>You've used today's free photo</Text>
                    <Text style={s.lockSub}>
                      Upgrade to Pro for unlimited photos — or close this and log without a photo.
                    </Text>
                  </BlurView>
                )}

                {/* shutter flash */}
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: flash }]}
                />
              </View>

              {/* controls */}
              <View style={[s.controls, barcode && { justifyContent: "center", gap: 9 }]}>
                {locked ? (
                  <Tap onPress={goPro} style={{ flex: 1 }}>
                    <View style={s.upgradeBtn}>
                      <Text style={s.upgradeText}>Upgrade to Pro</Text>
                    </View>
                  </Tap>
                ) : barcode ? (
                  <>
                    <RecDot T={T} />
                    <Text style={s.scanningText}>Scanning…</Text>
                  </>
                ) : (
                  <>
                    {/* the gallery — ringed green because it's the button that
                        actually works right now, and people need to find it */}
                    <Pressable onPress={pickFromGallery} style={[s.sideBtn, s.sideBtnLive]}>
                      <ImageIcon size={19} color={T.green} />
                    </Pressable>

                    <Shutter onPress={shoot} />

                    <Pressable onPress={() => H.tick()} style={s.sideBtn}>
                      <RefreshCw size={18} color="#FFFFFF" />
                    </Pressable>
                  </>
                )}
              </View>

              {!barcode && !locked && (
                <Text style={s.galleryHint}>Tap the gallery icon to use a photo from your phone</Text>
              )}
            </View>
          </TravelBorder>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* styles that don't need the theme */
const s0 = StyleSheet.create({
  previewCentre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  previewText: {
    fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: FONTS.body,
    textAlign: "center", lineHeight: 18, maxWidth: 230,
  },

  /* 64px squircle: 3px green rim → black gap → 44px lens */
  shutterWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  shutterHalo: {
    position: "absolute", width: 72, height: 72, borderRadius: 29,
    borderWidth: 1.5, borderColor: "#22C55E",
  },
  shutterRim: {
    position: "absolute", width: 64, height: 64, borderRadius: 26,
    overflow: "hidden",
  },
  rimFill: { width: "100%", height: "100%" },
  shutterGap: {
    position: "absolute", width: 58, height: 58, borderRadius: 23,
    backgroundColor: "#0A0A0A",
    alignItems: "center", justifyContent: "center",
    padding: 4,
  },
  lens: { width: "100%", height: "100%", borderRadius: 20 },
  lensTopSheen: {
    position: "absolute", top: 4, left: 4, right: 4, height: 13,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)", opacity: 0.55,
  },
  lensBottomShade: {
    position: "absolute", bottom: 4, left: 4, right: 4, height: 15,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
});

const styles = (T: any) =>
  StyleSheet.create({
    /* the widget floats over a dimmed screen, 20% up from the bottom */
    backdropWrap: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 18,
      paddingBottom: SCREEN_H * 0.2,
    },
    widgetWrap: { width: "100%", maxWidth: 344 },
    inner: { borderRadius: 23, overflow: "hidden", backgroundColor: "#000000" },

    head: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    },
    headText: { fontSize: 13, color: "rgba(255,255,255,0.9)", fontFamily: FONTS.headingMed },
    headClose: { padding: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 9 },

    freeBar: {
      flexDirection: "row", alignItems: "center", gap: 9,
      marginHorizontal: 12, marginBottom: 10,
      paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12,
      backgroundColor: "rgba(251,191,36,0.14)", borderWidth: 1, borderColor: "rgba(251,191,36,0.5)",
    },
    freeBarText: { flex: 1, fontSize: 10.5, color: "rgba(255,255,255,0.92)", fontFamily: FONTS.body, lineHeight: 14.5 },
    freeBarCta: { fontSize: 10.5, color: T.gold, fontFamily: FONTS.headingMed },

    preview: { height: PREVIEW_H, backgroundColor: "#000000", overflow: "hidden", position: "relative" },

    barcodeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 16 },
    barcodeHint: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: FONTS.body },
    barcodeFrame: {
      width: 230, height: 130, borderRadius: 16,
      borderWidth: 1.5, borderColor: "rgba(34,197,94,0.5)", overflow: "hidden",
    },

    lockWrap: { alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 24 },
    lockIcon: {
      width: 48, height: 48, borderRadius: 14, backgroundColor: T.gold,
      alignItems: "center", justifyContent: "center",
    },
    lockTitle: { fontSize: 15, color: "#FFFFFF", fontFamily: FONTS.heading, textAlign: "center" },
    lockSub: {
      fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontFamily: FONTS.body,
      textAlign: "center", lineHeight: 16.5, maxWidth: 240,
    },

    controls: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 26, paddingTop: 16, paddingBottom: 12,
      backgroundColor: "#000000",
    },
    sideBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center", justifyContent: "center",
    },
    sideBtnLive: {
      backgroundColor: "rgba(34,197,94,0.14)",
      borderWidth: 1, borderColor: "rgba(34,197,94,0.5)",
    },
    galleryHint: {
      fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: FONTS.body,
      textAlign: "center", paddingBottom: 16, backgroundColor: "#000000",
    },
    scanningText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: FONTS.headingMed },
    upgradeBtn: { backgroundColor: T.gold, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    upgradeText: { fontSize: 13.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  });