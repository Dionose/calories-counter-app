// components/CameraSheet.tsx
// The capture widget. NOT a full screen — a card that rises over whatever
// screen opened it, with the app still visible behind. Used everywhere in the
// app that needs a camera: meal logging, barcode scanning, and now the profile
// photo.
//
// WHERE IT SITS DEPENDS ON WHAT IT'S POINTING AT. `anchor` decides:
//
//   "bottom" (the default) — a plate on a table. You hold the phone over the
//     food and look down, so the widget sits low and your thumb reaches the
//     shutter without shifting your grip.
//
//   "top" — your own face. You hold the phone UP and look at it straight on,
//     and a preview pinned near the bottom means watching one part of the
//     screen while your face is framed in another. It also gets a taller
//     preview, because a portrait needs vertical room that a plate doesn't.
//
// THE CAMERA IS REAL NOW. expo-camera needs a development build, which is why
// this was a gradient placeholder for so long. Three ways in:
//
//   THE SHUTTER takes an actual photo and returns its file URI.
//   THE GALLERY picks an existing one — still useful, since people often
//     photograph a meal and log it later.
//   THE BARCODE SCANNER reads the code itself, no button, and hands the digits
//     up for an Open Food Facts lookup.
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Lock, RefreshCw, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

const { height: SCREEN_H } = Dimensions.get("window");

const PREVIEW_H = 300;
/* TALLER FOR A FACE. A plate is wide and shallow; a head and shoulders needs
   vertical room, and 300px crops people at the chin on a phone held at arm's
   length. */
const PREVIEW_H_TALL = 380;

/* the formats worth reading. Food packaging is EAN-13 almost everywhere and
   UPC-A in North America; the rest are here because they cost nothing to
   include and someone will inevitably scan something unusual. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"];

/* ---------- the shutter ----------
   A SQUIRCLE, not a circle: a thin green rim hugging a pearlescent lens, with
   a black gap between them. The rim blinks on and off rather than glowing —
   it's a rim light, so it stays tight to the shape at all times. */
function Shutter({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
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
    <Pressable onPress={onPress} disabled={busy}>
      <View style={[s0.shutterWrap, busy && { opacity: 0.5 }]}>
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
  visible, mode = "photo", caption, locked, showFreeBar,
  anchor = "bottom", startFacing = "back", hideGallery,
  onClose, onCapture, onBarcode,
}: {
  visible: boolean;
  mode?: "photo" | "barcode";
  /** overrides the default header text — "Take a photo" for the profile avatar */
  caption?: string;
  /** free user who's already spent today's photo — preview blurs, controls go gold */
  locked?: boolean;
  /** the amber "1 photo left" bar, shown to free users BEFORE they shoot */
  showFreeBar?: boolean;
  /** where the widget sits, and how tall the preview is — see the note at the
      top of this file. Default is bottom, which is every existing caller. */
  anchor?: "bottom" | "top";
  /** which camera to open on. A profile photo wants the front one; opening on
      the back camera means everyone's first sight of this screen is their own
      ceiling, followed by hunting for the flip button. */
  startFacing?: "back" | "front";
  /** hide the gallery button. The profile flow offers "choose from library"
      as its own option on the sheet before this opens, so showing it again
      here is a second door to the same room. */
  hideGallery?: boolean;
  onClose: () => void;
  /** the captured or picked image's URI */
  onCapture: (uri?: string) => void;
  /** the digits off a barcode — only fires in barcode mode */
  onBarcode?: (code: string) => void;
}) {
  const { T, openPaywall } = useApp();
  const top = anchor === "top";
  const s = styles(T, top);
  const barcode = mode === "barcode";

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<"back" | "front">(startFacing);
  const [taking, setTaking] = useState(false);

  /* one scan per opening. Without this the scanner fires continuously while
     the code is in frame — dozens of lookups a second for the same product. */
  const scanned = useRef(false);

  const rise = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, {
      toValue: visible ? 1 : 0,
      duration: visible ? 460 : 200,
      easing: visible ? Easing.bezier(0.2, 0.9, 0.25, 1) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();

    if (visible) {
      scanned.current = false;
      /* back to the requested camera each time — someone who flipped to the
         front last time shouldn't have their next meal photo be a selfie */
      setFacing(startFacing);
    }
  }, [visible]);

  /* Ask at the moment the camera opens, not on mount. Requesting access to
     someone's camera before they've shown any interest in using it is how
     apps get denied on the first prompt — and iOS only asks once. */
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission?.granted]);

  /* a top-anchored widget drops DOWN into place; a bottom one rises up. Coming
     from the wrong direction reads as the animation being broken. */
  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [top ? -SCREEN_H * 0.4 : SCREEN_H * 0.5, 0],
  });
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  /* THE REAL SHUTTER. quality 0.9 rather than 1: the difference is invisible
     at any size this gets displayed, and photos.ts resizes on upload anyway —
     but a smaller file means a faster write and less memory held while the
     result screen renders. */
  const shoot = async () => {
    if (taking || !camRef.current) return;
    H.tap();
    setTaking(true);

    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await camRef.current.takePictureAsync({
        quality: 0.9,
        /* no base64 here — photos.ts reads the file directly when it uploads,
           and asking for base64 doubles the memory for a string we'd discard */
        skipProcessing: false,
      });
      setTaking(false);
      if (photo?.uri) onCapture(photo.uri);
    } catch {
      setTaking(false);
      /* a failed capture shouldn't strand the user on a dead camera —
         continuing with no photo lands them on the manual-entry path */
      onCapture();
    }
  };

  /* the gallery. Still worth having with a working camera: people photograph
     a meal and log it hours later, and forcing them to re-shoot cold food
     isn't a feature. */
  const pickFromGallery = async () => {
    H.tap();

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      /* no cropping. A meal photo shouldn't be squared off — the AI wants the
         whole plate, and forcing a crop can cut food out of the frame. */
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    H.success();
    onCapture(result.assets[0].uri);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned.current || locked) return;
    scanned.current = true;
    H.success();
    onBarcode?.(data);
  };

  const goPro = () => {
    H.tap();
    onClose();
    setTimeout(() => openPaywall("subscribe"), 240);
  };

  const canShowCamera = permission?.granted && !locked;
  const showGallery = !hideGallery;

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
                {canShowCamera ? (
                  <CameraView
                    ref={camRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    /* the scanner only runs in barcode mode — leaving it on
                       for meal photos would burn battery reading nothing */
                    barcodeScannerSettings={barcode ? { barcodeTypes: BARCODE_TYPES as any } : undefined}
                    onBarcodeScanned={barcode ? handleBarcode : undefined}
                  />
                ) : (
                  <View style={StyleSheet.absoluteFill}>
                    <LinearGradient colors={["#1E1A16", "#0B0A09"]} style={StyleSheet.absoluteFill} />
                    <View style={s0.previewCentre}>
                      {!permission ? (
                        <ActivityIndicator size="small" color={T.green} />
                      ) : (
                        <>
                          <Camera size={38} color="rgba(255,255,255,0.35)" />
                          <Text style={s0.previewText}>
                            {permission.canAskAgain
                              ? "MOTION needs camera access to photograph your meals."
                              : "Camera access is off. You can turn it on in Settings → MOTION."}
                          </Text>
                          {permission.canAskAgain && (
                            <Tap onPress={() => requestPermission()} style={{ marginTop: 6 }}>
                              <View style={s.permBtn}>
                                <Text style={s.permBtnText}>Allow camera</Text>
                              </View>
                            </Tap>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                )}

                {barcode && !locked && canShowCamera && (
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
                    <Text style={s.scanningText}>
                      {canShowCamera ? "Scanning…" : "Waiting for camera access"}
                    </Text>
                  </>
                ) : (
                  <>
                    {showGallery ? (
                      <Pressable onPress={pickFromGallery} style={s.sideBtn}>
                        <ImageIcon size={19} color="#FFFFFF" />
                      </Pressable>
                    ) : (
                      /* keeps the shutter centred when the gallery is hidden —
                         an off-centre shutter looks like a layout fault */
                      <View style={s.sideBtn} />
                    )}

                    <Shutter onPress={shoot} busy={taking || !canShowCamera} />

                    <Pressable
                      onPress={() => { H.tick(); setFacing((f) => (f === "back" ? "front" : "back")); }}
                      style={s.sideBtn}
                    >
                      <RefreshCw size={18} color="#FFFFFF" />
                    </Pressable>
                  </>
                )}
              </View>
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

const styles = (T: any, top: boolean) =>
  StyleSheet.create({
    /* the widget floats over a dimmed screen — low for a plate, high for a
       face. See the note at the top of the file. */
    backdropWrap: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: top ? "flex-start" : "flex-end",
      paddingHorizontal: 18,
      paddingTop: top ? SCREEN_H * 0.07 : 0,
      paddingBottom: top ? 0 : SCREEN_H * 0.2,
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

    preview: {
      height: top ? PREVIEW_H_TALL : PREVIEW_H,
      backgroundColor: "#000000", overflow: "hidden", position: "relative",
    },

    permBtn: {
      backgroundColor: T.green, borderRadius: 11,
      paddingVertical: 10, paddingHorizontal: 20,
    },
    permBtnText: { fontSize: 13, color: T.ink, fontFamily: FONTS.headingMed },

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
      paddingHorizontal: 26, paddingTop: 16, paddingBottom: 20,
      backgroundColor: "#000000",
    },
    sideBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center", justifyContent: "center",
    },
    scanningText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: FONTS.headingMed },
    upgradeBtn: { backgroundColor: T.gold, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    upgradeText: { fontSize: 13.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  });