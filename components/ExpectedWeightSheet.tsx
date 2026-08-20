// components/ExpectedWeightSheet.tsx
// The sheet behind the weight chip on Home.
//
// THIS SHEET DOES NOT TAKE A WEIGHT. That's the whole point of it. Home shows
// where your plan says you should be; Stats is where you say what you actually
// are. Two places to enter the same number is how two numbers end up
// disagreeing, and the app previously had exactly that — a weigh-in sheet on
// Home and another on Stats, with a chip that averaged three readings and so
// showed neither.
//
// IT ALSO TEACHES THE WEIGH-IN. Someone reading this is about to go and stand
// on a scale, which makes it the one moment where "first thing in the morning,
// after the toilet, before eating or drinking" is actually useful rather than
// nagging. A weight taken after dinner can read two kilos high on food and
// water alone, and a user who doesn't know that reads it as failure.
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FONTS } from "../constants/theme";
import Icon from "./Icon";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

const SCREEN_H = Dimensions.get("window").height;
/* TravelBorder's card sizes to its content, so the sheet needs an explicit
   height — same reason the hero and leaderboard sheets carry one. */
const SHEET_H = Math.round(SCREEN_H * 0.72);

export default function ExpectedWeightSheet({
  T,
  visible,
  onClose,
  onGoLog,
  expectedShown,
  unit,
  losing,
  paceShown,
  targetShown,
  lastShown,
  lastOn,
}: {
  T: any;
  visible: boolean;
  onClose: () => void;
  /** takes them to Stats, where a real weight is entered */
  onGoLog: () => void;
  /** already converted to the user's unit — this component does no maths */
  expectedShown: number;
  unit: "kg" | "lbs";
  losing: boolean;
  paceShown: number;
  targetShown: number;
  lastShown: number | null;
  /** "Aug 19" — already formatted, or null if they've never weighed in */
  lastOn: string | null;
}) {
  const a = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  useEffect(() => {
    if (!visible) return;
    busy.current = true;
    Animated.timing(a, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => { busy.current = false; });
  }, [visible]);

  /* the close animation has to finish before the modal unmounts, or the sheet
     vanishes instead of settling */
  const close = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(a, {
      toValue: 0,
      duration: 190,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => { busy.current = false; onClose(); });
  }, [onClose]);

  const lift = a.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const s = styles(T);

  const direction = losing ? "lose" : "gain";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[s.backdrop, { opacity: a }]}>
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <View style={s.centre} pointerEvents="box-none">
          <Animated.View
            style={{ width: "100%", maxWidth: 380, opacity: a, transform: [{ translateY: lift }] }}
          >
            <TravelBorder color={T.green} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
              <View style={{ height: SHEET_H }}>
                <View style={s.head}>
                  <View style={{ width: 34 }} />
                  <Text style={s.title}>Expected weight</Text>
                  <Pressable onPress={close} hitSlop={14} style={s.close}>
                    <X size={18} color={T.sub} />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={s.stage}>
                    <Icon name="scale" size={46} mode="loop" />
                    <View style={s.bigRow}>
                      <Text style={s.big}>{expectedShown.toFixed(1)}</Text>
                      <Text style={s.bigUnit}>{unit}</Text>
                    </View>
                    <Text style={s.stageCaption}>where your plan puts you today</Text>
                  </View>

                  <Text style={s.body}>
                    This isn't a measurement — it's MOTION's estimate. It starts from the weight you
                    gave when you set up your plan and moves by {paceShown.toFixed(1)} {unit} a week,
                    the pace you chose, towards your target of {targetShown.toFixed(1)} {unit}.
                  </Text>

                  <Text style={[s.body, { marginTop: 12 }]}>
                    It moves on its own, every day, whether or not you weigh yourself. That's what
                    makes it useful: open the app after a fortnight away and you can see what the
                    plan expected of that fortnight.
                  </Text>

                  {lastShown != null && lastOn ? (
                    <View style={s.lastCard}>
                      <Text style={s.lastLabel}>YOUR LAST WEIGH-IN</Text>
                      <Text style={s.lastValue}>
                        {lastShown.toFixed(1)} <Text style={s.lastUnit}>{unit}</Text>
                        <Text style={s.lastDate}>  ·  {lastOn}</Text>
                      </Text>
                    </View>
                  ) : (
                    <View style={s.lastCard}>
                      <Text style={s.lastLabel}>YOUR LAST WEIGH-IN</Text>
                      <Text style={s.lastEmpty}>
                        Nothing logged yet — the number above is an estimate until you weigh in.
                      </Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  <Text style={s.smallTitle}>When to weigh yourself</Text>
                  <Text style={s.body}>
                    First thing in the morning, after you've been to the toilet, before you eat or
                    drink anything. That's the most consistent your body gets all day.
                  </Text>

                  <Text style={[s.body, { marginTop: 10 }]}>
                    Weigh yourself in the evening instead and you can read a kilo or two heavier on
                    food and water alone. Nothing has gone wrong — it's just not the same
                    measurement, and comparing the two tells you nothing.
                  </Text>

                  <Text style={[s.body, { marginTop: 10 }]}>
                    Once a week is plenty. Weight moves in steps rather than a line, and day-to-day
                    swings are mostly water.
                  </Text>

                  <View style={s.divider} />

                  <Text style={s.smallTitle}>If you've weighed yourself</Text>
                  <Text style={s.body}>
                    Tell MOTION the real number and the estimate above resets to it, then carries on
                    counting from there. Higher than expected, lower than expected — either way the
                    plan works from the truth rather than from a guess, and you keep aiming to{" "}
                    {direction} at your own pace.
                  </Text>
                </ScrollView>

                <View style={s.footer}>
                  <Tap onPress={() => { close(); setTimeout(onGoLog, 220); }}>
                    <View style={s.cta}>
                      <Text style={s.ctaText}>I've weighed myself</Text>
                    </View>
                  </Tap>
                  <Text style={s.footNote}>Takes you to Stats, where your weight is logged</Text>
                </View>
              </View>
            </TravelBorder>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
    title: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading, letterSpacing: 0.3 },
    close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },

    stage: { alignItems: "center", paddingTop: 6, paddingBottom: 16 },
    bigRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
    big: { fontSize: 44, color: T.text, fontFamily: FONTS.heading },
    bigUnit: { fontSize: 15, color: T.sub, fontFamily: FONTS.body },
    stageCaption: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, marginTop: 4 },

    body: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },

    lastCard: { marginTop: 16, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 14 },
    lastLabel: { fontSize: 9.5, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body },
    lastValue: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, marginTop: 6 },
    lastUnit: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    lastDate: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body },
    lastEmpty: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18, marginTop: 6 },

    divider: { height: 1, backgroundColor: T.border, marginVertical: 16 },
    smallTitle: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 6 },

    footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: T.border },
    cta: { backgroundColor: T.green, borderRadius: 14, padding: 14, alignItems: "center" },
    ctaText: { color: T.ink, fontFamily: FONTS.headingMed, fontSize: 14 },
    footNote: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 8 },
  });