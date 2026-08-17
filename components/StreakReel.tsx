// components/StreakReel.tsx
// The sheet that opens from the Calendar's fade-countdown card. It cycles
// three phases — full colour today, plain after the free window, colour back
// with Pro — each showing a mini month so the change is visible rather than
// described.
//
// The hold-to-pause hint sits ABOVE the phase copy on purpose: telling someone
// they can pause is only useful before they've started reading, not after.
import { LinearGradient } from "expo-linear-gradient";
import { Check, Crown, Flame, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS, TIERS, ULT_COLORS } from "../constants/theme";
import Tap from "./Tap";

const PHASE_MS = 2100;

/** the run length a day would have in the demo month, so the mini grid
    climbs Spark → Ultimate the way a real month does */
function demoTier(day: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (day > 24) return 0;
  if (day <= 4) return 1;
  if (day <= 8) return 2;
  if (day <= 12) return 3;
  if (day <= 16) return 4;
  return 5;
}

function MiniMonth({ plain }: { plain: boolean }) {
  const { T } = useApp();
  const cells = [...Array(2).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {cells.map((d, i) => {
        if (d == null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }} />;

        const tr = demoTier(d);
        const lit = tr > 0;
        const isUlt = tr === 5;

        if (!lit) {
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 5, backgroundColor: T.emptyTile, borderWidth: 1, borderColor: T.border }} />
            </View>
          );
        }

        if (plain) {
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 5, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" }}>
                <Check size={8} color={T.green} />
              </View>
            </View>
          );
        }

        if (isUlt) {
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <LinearGradient
                colors={ULT_COLORS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" }}
              >
                <Flame size={8} color="#0A0A0A" fill="#0A0A0A" />
              </LinearGradient>
            </View>
          );
        }

        const t = TIERS[tr as 1 | 2 | 3 | 4];
        return (
          <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
            <View style={{ flex: 1, borderRadius: 5, backgroundColor: `${t.color}33`, borderWidth: 1, borderColor: t.color, alignItems: "center", justifyContent: "center" }}>
              <Flame size={8} color={t.color} fill={t.color} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function StreakReel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { T, openPaywall } = useApp();
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const s = styles(T);

  // reset to the start each time it opens
  useEffect(() => {
    if (visible) {
      setPhase(0);
      setPaused(false);
      fade.setValue(1);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || paused) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 3), PHASE_MS);
    return () => clearInterval(t);
  }, [visible, paused]);

  // cross-fade the grid on each phase change
  useEffect(() => {
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [phase]);

  const COPY = [
    { title: "Today", body: "Full colour — you climb Spark to Ultimate.", color: T.green },
    { title: "After 30 days", body: "Goes plain. Your streak keeps counting, hidden.", color: T.sub },
    { title: "With Pro", body: "Colour comes right back — where you left off.", color: T.gold },
  ][phase];

  const goPro = () => {
    onClose();
    setTimeout(() => openPaywall("subscribe"), 220);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.centre} pointerEvents="box-none">
          <Pressable
            onPressIn={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            style={s.card}
          >
            <View style={s.head}>
              <Text style={s.title}>What happens to your streak</Text>
              <Pressable onPress={onClose} hitSlop={14} style={s.close}>
                <X size={16} color={T.sub} />
              </Pressable>
            </View>

            {/* phase bars */}
            <View style={s.bars}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    s.bar,
                    { backgroundColor: i === phase ? (i === 2 ? T.gold : i === 1 ? T.sub : T.green) : T.border },
                  ]}
                />
              ))}
            </View>

            <Animated.View style={{ paddingHorizontal: 30, opacity: fade }}>
              <MiniMonth plain={phase === 1} />
            </Animated.View>

            {/* the hint comes before the copy — you need to know you can pause
                while there's still something left to read */}
            <View style={[s.hintPill, paused && { backgroundColor: T.greenBg, borderColor: T.greenBorder }]}>
              <Text style={[s.hintText, { color: paused ? T.green : T.micro }]}>
                {paused ? "Paused — release to continue" : "Hold anywhere to pause & read"}
              </Text>
            </View>

            <View style={s.copyBlock}>
              <Text style={[s.copyTitle, { color: COPY.color }]}>{COPY.title}</Text>
              <Text style={s.copyBody}>{COPY.body}</Text>
            </View>

            <Text style={s.reassure}>
              Your streak never stops — it keeps counting in the background. Subscribe to Pro and your
              colours come right back, right where you left off.
            </Text>

            <Tap onPress={goPro}>
              <View style={s.cta}>
                <Crown size={18} color="#0A0A0A" />
                <Text style={s.ctaText}>Keep my colours — go Pro</Text>
              </View>
            </Tap>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    card: { width: "100%", maxWidth: 360, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 22, padding: 18 },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed, flex: 1 },
    close: { width: 30, height: 30, alignItems: "center", justifyContent: "center", backgroundColor: T.cardHi, borderRadius: 9 },

    bars: { flexDirection: "row", gap: 5, marginBottom: 14 },
    bar: { flex: 1, height: 3, borderRadius: 2 },

    hintPill: {
      alignSelf: "center",
      marginTop: 14,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: T.cardHi,
      borderWidth: 1,
      borderColor: T.border,
    },
    hintText: { fontSize: 10.5, fontFamily: FONTS.headingMed },

    copyBlock: { marginTop: 14, minHeight: 42 },
    copyTitle: { fontSize: 14, fontFamily: FONTS.headingMed },
    copyBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 17 },

    reassure: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 17, marginTop: 12, marginBottom: 14 },

    cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: T.gold, borderRadius: 13, paddingVertical: 13 },
    ctaText: { fontSize: 14, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  });