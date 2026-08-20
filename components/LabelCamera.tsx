// components/LabelCamera.tsx
// Photographing a packet — either the front of it or the nutrition panel.
//
// ONE CAMERA, TWO JOBS. The front photo answers "what is this?"; the panel
// photo answers "what's in it?". They need different wording, a different
// framing guide and a different help sheet, but the same taller viewfinder —
// so `mode` switches the content rather than a second component duplicating
// the whole thing.
//
// DELIBERATELY TALLER than the meal camera. That one is a card floating over
// the screen; this one nearly fills it. The difference is the point: framing
// matters far more here. A meal photo just needs the plate in shot, but this
// has to be READABLE TEXT, and a bigger viewfinder makes people take more care
// without being told to.
//
// WHY THIS EXISTS AT ALL. Open Food Facts is volunteer-entered, so a record
// often disagrees with the packet in the user's hand — a bottle reading
// "¼ cup (60 ml)" can be stored as "1 tbsp (19 g)". And plenty of real
// products aren't in any database. Nothing in our code resolves that, because
// only the person holding the packet can see what it says. This is them
// showing us.
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Info, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

const { height: SCREEN_H } = Dimensions.get("window");
const PREVIEW_H = Math.round(SCREEN_H * 0.52);

export type CameraMode = "panel" | "front";

/* ---------- the shutter ----------
   The same squircle as the meal camera, so it still reads as MOTION's — but
   gold rather than green, matching the "exactly as the pack states it" rung
   these photos produce. */
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

  const rimOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Pressable onPress={onPress} disabled={busy}>
      <View style={[s0.shutterWrap, busy && { opacity: 0.5 }]}>
        <Animated.View style={[s0.shutterHalo, { opacity: haloOpacity }]} pointerEvents="none" />

        <Animated.View style={[s0.shutterRim, { opacity: rimOpacity }]}>
          <LinearGradient
            colors={["#FDE68A", "#FBBF24", "#D97706", "#FBBF24"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s0.rimFill}
          />
        </Animated.View>

        <View style={s0.shutterGap}>
          <LinearGradient
            colors={["#FFFFFF", "#E8E8E8", "#C7C7C7"]}
            start={{ x: 0.25, y: 0.15 }}
            end={{ x: 0.85, y: 1 }}
            style={s0.lens}
          />
          <View style={s0.lensTopSheen} pointerEvents="none" />
          <View style={s0.lensBottomShade} pointerEvents="none" />
        </View>
      </View>
    </Pressable>
  );
}

export default function LabelCamera({
  visible, mode = "panel", productName, onClose, onCapture, onSkip,
}: {
  visible: boolean;
  /** "front" reads the NAME off the packet; "panel" reads the numbers */
  mode?: CameraMode;
  /** what's already known, so the screen can confirm it before asking for more */
  productName?: string | null;
  onClose: () => void;
  onCapture: (uri: string) => void;
  /** the escape. Absent when there IS no alternative — without a panel photo
      there are no numbers at all, so that step can't be skipped. */
  onSkip?: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);
  const front = mode === "front";

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [taking, setTaking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const rise = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, {
      toValue: visible ? 1 : 0,
      duration: visible ? 420 : 200,
      easing: visible ? Easing.bezier(0.2, 0.9, 0.25, 1) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission?.granted]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.4, 0] });

  const shoot = async () => {
    if (taking || !camRef.current) return;
    H.tap();
    setTaking(true);

    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      setTaking(false);
      if (photo?.uri) onCapture(photo.uri);
    } catch {
      setTaking(false);
    }
  };

  const pickFromGallery = async () => {
    H.tap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;
    H.success();
    onCapture(result.assets[0].uri);
  };

  const ready = permission?.granted;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.screen}>
        <Animated.View style={{ flex: 1, opacity: rise, transform: [{ translateY }] }}>

          <View style={s.head}>
            <Pressable onPress={onClose} hitSlop={12} style={s.headBtn}>
              <X size={20} color={T.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.headTitle}>
                {front ? "The front of the pack" : "Nutrition facts"}
              </Text>
            </View>
            <Pressable onPress={() => { H.tap(); setShowHelp(true); }} hitSlop={12} style={s.headBtn}>
              <Info size={19} color={T.gold} />
            </Pressable>
          </View>

          {/* what's already known. On the panel step this confirms we got the
              right product before asking for anything else. */}
          {productName ? (
            <View style={s.foundCard}>
              <Text style={s.foundLabel}>{front ? "ADDING" : "GOT IT"}</Text>
              <Text style={s.foundName} numberOfLines={2}>{productName}</Text>
            </View>
          ) : null}

          <Text style={s.ask}>
            {front
              ? "Point at the front of the packet and MOTION reads the name — no typing."
              : "Now the nutrition facts panel, and MOTION reads the exact numbers off your packet."}
          </Text>

          <View style={s.previewWrap}>
            <TravelBorder color={T.gold} cardBg="#000000" borderColor={T.border} radius={22} strokeWidth={2.5}>
              <View style={s.preview}>
                {ready ? (
                  <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
                ) : (
                  <View style={StyleSheet.absoluteFill}>
                    <LinearGradient colors={["#1E1A16", "#0B0A09"]} style={StyleSheet.absoluteFill} />
                    <View style={s.permCentre}>
                      {!permission ? (
                        <ActivityIndicator size="small" color={T.gold} />
                      ) : (
                        <>
                          <Camera size={34} color="rgba(255,255,255,0.35)" />
                          <Text style={s.permText}>
                            {permission.canAskAgain
                              ? "MOTION needs camera access to read the packet."
                              : "Camera access is off. Turn it on in Settings → MOTION."}
                          </Text>
                          {permission.canAskAgain && (
                            <Tap onPress={() => requestPermission()} style={{ marginTop: 4 }}>
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

                {/* THE FRAMING GUIDE, shaped for what's being photographed.
                    A panel is a tall narrow column; a product front is wider
                    than it is tall. A square box would encourage the wrong
                    framing for both. */}
                {ready && (
                  <View style={s.guideWrap} pointerEvents="none">
                    <View style={front ? s.guideWide : s.guideTall}>
                      <View style={[s.corner, s.cornerTL]} />
                      <View style={[s.corner, s.cornerTR]} />
                      <View style={[s.corner, s.cornerBL]} />
                      <View style={[s.corner, s.cornerBR]} />
                    </View>
                    <Text style={s.guideText}>
                      {front ? "Get the name in the box" : "Fill the box with the panel"}
                    </Text>
                  </View>
                )}

                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: flash }]}
                />
              </View>
            </TravelBorder>
          </View>

          <View style={s.controls}>
            <Pressable onPress={pickFromGallery} style={s.sideBtn}>
              <ImageIcon size={19} color="rgba(255,255,255,0.9)" />
            </Pressable>

            <Shutter onPress={shoot} busy={taking || !ready} />

            {/* balances the row — nobody photographs a packet with the front
                camera, so the flip button has no place here */}
            <View style={{ width: 40 }} />
          </View>

          {/* THE ESCAPE, framed honestly and kept quiet. On the front step it's
              typing; on the panel step it's the database figures. Absent
              entirely when there's no alternative worth offering. */}
          {onSkip ? (
            <Tap onPress={() => { H.tick(); onSkip(); }} style={s.skipWrap}>
              <View style={s.skipCard}>
                <Text style={s.skipTitle}>
                  {front ? "Type the name instead" : "Use what we found instead"}
                </Text>
                <Text style={s.skipBody}>
                  {front
                    ? "For a jar with a handwritten sticker, or anything the camera can't make out."
                    : "The nutrition already came off this product's label. Only the serving size is MOTION's estimate — fine for most things, and you can adjust it after."}
                </Text>
              </View>
            </Tap>
          ) : (
            <View style={{ height: 26 }} />
          )}
        </Animated.View>

        {/* WHAT TO PHOTOGRAPH. Not everyone knows the phrase "nutrition
            facts", and the panel sits in a different place on every packet. */}
        <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
          <View style={{ flex: 1 }}>
            <Pressable style={s.helpBackdrop} onPress={() => setShowHelp(false)} />
            <View style={s.helpCentre} pointerEvents="box-none">
              <View style={s.helpCard}>
                <View style={s.helpHead}>
                  <Text style={s.helpTitle}>What to photograph</Text>
                  <Pressable onPress={() => setShowHelp(false)} hitSlop={12} style={s.helpClose}>
                    <X size={17} color={T.sub} />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: SCREEN_H * 0.5 }} showsVerticalScrollIndicator={false}>
                  {front ? (
                    <>
                      <Text style={s.helpBody}>
                        The side of the packet with the product's name on it — usually the biggest
                        text, the bit you'd read from across a shop.
                      </Text>
                      <Text style={[s.helpBody, { marginTop: 12 }]}>
                        MOTION only needs the name and the brand. Nothing else on the front
                        matters, so don't worry about getting the whole packet in.
                      </Text>

                      <View style={s.helpDivider} />

                      <Text style={s.helpSubhead}>For a clean read</Text>
                      <Text style={s.helpBody}>
                        Hold steady and let the camera focus. Angle away from bright light rather
                        than under it — glossy packaging reflects badly.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.helpBody}>
                        The panel is usually on the back or side of the packet, headed{" "}
                        <Text style={s.helpBold}>Nutrition Facts</Text>,{" "}
                        <Text style={s.helpBold}>Nutritional Value</Text> or{" "}
                        <Text style={s.helpBold}>Nutrition Information</Text>.
                      </Text>

                      {/* a drawn mock-up beats a description — most people
                          recognise the shape instantly even if the words
                          vary */}
                      <View style={s.mock}>
                        <Text style={s.mockHead}>Nutrition Facts</Text>
                        <View style={s.mockRule} />
                        <Text style={s.mockServing}>Per 1/2 cup (125 ml)</Text>
                        <View style={s.mockRuleThick} />
                        <View style={s.mockRow}>
                          <Text style={s.mockCal}>Calories</Text>
                          <Text style={s.mockCalNum}>100</Text>
                        </View>
                        <View style={s.mockRule} />
                        {[["Fat", "0.5 g"], ["Carbohydrate", "18 g"], ["Protein", "6 g"]].map(([k, v]) => (
                          <View key={k} style={s.mockRow}>
                            <Text style={s.mockKey}>{k}</Text>
                            <Text style={s.mockVal}>{v}</Text>
                          </View>
                        ))}
                      </View>

                      <Text style={s.helpBody}>
                        That's the whole thing — the serving size at the top and the numbers under
                        it. Get all of it in frame, including the serving line, since that's the
                        part databases most often get wrong.
                      </Text>

                      <View style={s.helpDivider} />

                      <Text style={s.helpSubhead}>For a clean read</Text>
                      <Text style={s.helpBody}>
                        Hold steady and let the camera focus before you shoot. Flatten a curved
                        packet if you can. Avoid glare — angle away from a bright light rather
                        than under it. Small print is where blur costs you.
                      </Text>
                    </>
                  )}
                </ScrollView>

                <Tap onPress={() => setShowHelp(false)} style={{ marginTop: 16 }}>
                  <View style={s.helpBtn}>
                    <Text style={s.helpBtnText}>Got it</Text>
                  </View>
                </Tap>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

/* styles that don't need the theme */
const s0 = StyleSheet.create({
  shutterWrap: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  shutterHalo: {
    position: "absolute", width: 76, height: 76, borderRadius: 30,
    borderWidth: 1.5, borderColor: "#FBBF24",
  },
  shutterRim: {
    position: "absolute", width: 68, height: 68, borderRadius: 27,
    overflow: "hidden",
  },
  rimFill: { width: "100%", height: "100%" },
  shutterGap: {
    position: "absolute", width: 61, height: 61, borderRadius: 24,
    backgroundColor: "#0A0A0A",
    alignItems: "center", justifyContent: "center",
    padding: 4,
  },
  lens: { width: "100%", height: "100%", borderRadius: 21 },
  lensTopSheen: {
    position: "absolute", top: 4, left: 4, right: 4, height: 14,
    borderTopLeftRadius: 21, borderTopRightRadius: 21,
    backgroundColor: "rgba(255,255,255,0.9)", opacity: 0.55,
  },
  lensBottomShade: {
    position: "absolute", bottom: 4, left: 4, right: 4, height: 16,
    borderBottomLeftRadius: 21, borderBottomRightRadius: 21,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
});

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    head: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingTop: 56, paddingBottom: 8,
    },
    headBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading, letterSpacing: 0.3 },

    foundCard: {
      marginHorizontal: 18, marginBottom: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 13, paddingVertical: 10, paddingHorizontal: 13,
    },
    foundLabel: { fontSize: 8.5, letterSpacing: 1, color: T.green, fontFamily: FONTS.headingMed },
    foundName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, marginTop: 3 },

    ask: {
      fontSize: 12.5, color: T.sub, fontFamily: FONTS.body,
      paddingHorizontal: 20, marginBottom: 12, lineHeight: 18,
    },

    previewWrap: { paddingHorizontal: 16 },
    preview: { height: PREVIEW_H, backgroundColor: "#000000", overflow: "hidden", borderRadius: 19, position: "relative" },

    permCentre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 },
    permText: {
      fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontFamily: FONTS.body,
      textAlign: "center", lineHeight: 18,
    },
    permBtn: { backgroundColor: T.gold, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 22 },
    permBtnText: { fontSize: 13, color: "#0A0A0A", fontFamily: FONTS.headingMed },

    guideWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 14 },
    /* a panel is a tall narrow column */
    guideTall: { width: "58%", height: "72%", position: "relative" },
    /* a product front is wider than it is tall */
    guideWide: { width: "82%", height: "48%", position: "relative" },
    corner: { position: "absolute", width: 26, height: 26, borderColor: "#FBBF24" },
    cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
    guideText: {
      position: "absolute", bottom: 14,
      fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: FONTS.body,
    },

    controls: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 44, paddingTop: 18, paddingBottom: 14,
    },
    sideBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },

    skipWrap: { paddingHorizontal: 18, paddingBottom: 26 },
    skipCard: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, padding: 14,
    },
    skipTitle: { fontSize: 13.5, color: T.green, fontFamily: FONTS.headingMed },
    skipBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 16.5 },

    /* help */
    helpBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    helpCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    helpCard: {
      width: "100%", maxWidth: 360,
      backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
      borderRadius: 22, padding: 20,
    },
    helpHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    helpTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    helpClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    helpBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },
    helpBold: { color: T.text, fontFamily: FONTS.headingMed },
    helpSubhead: { fontSize: 12.5, color: T.gold, fontFamily: FONTS.headingMed, marginBottom: 6 },
    helpDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

    /* the drawn panel — plain white and black on purpose, since that's what a
       real one looks like and recognition is the whole job */
    mock: {
      backgroundColor: "#FFFFFF", borderRadius: 10,
      paddingVertical: 12, paddingHorizontal: 14,
      marginVertical: 14,
    },
    mockHead: { fontSize: 16, color: "#000000", fontFamily: FONTS.heading },
    mockRule: { height: 1, backgroundColor: "#000000", marginVertical: 5 },
    mockRuleThick: { height: 5, backgroundColor: "#000000", marginVertical: 5 },
    mockServing: { fontSize: 11, color: "#000000", fontFamily: FONTS.body },
    mockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 2 },
    mockCal: { fontSize: 15, color: "#000000", fontFamily: FONTS.heading },
    mockCalNum: { fontSize: 17, color: "#000000", fontFamily: FONTS.heading },
    mockKey: { fontSize: 11.5, color: "#000000", fontFamily: FONTS.body },
    mockVal: { fontSize: 11.5, color: "#000000", fontFamily: FONTS.headingMed },

    helpBtn: { backgroundColor: T.gold, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    helpBtnText: { fontSize: 14, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  });