// components/BlurLock.tsx
// The app-wide Pro blur-lock. Wraps a widget's CONTENT and, when locked:
//   · blurs only that content
//   · keeps the widget's NAME clearly readable, so the user sees exactly which
//     Pro feature they're missing
//   · taps through to the paywall — every locked thing is a door to the same
//     subscribe screen
//
// Put this INSIDE a TravelBorder, not around it, so the traveling border stays
// crisp and uniform with the unlocked widgets beside it.
import { BlurView } from "expo-blur";
import { Lock } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";

type Props = {
  /** the widget's name — stays crisp while locked */
  label: string;
  /** one short line under the label */
  sub?: string;
  locked: boolean;
  /** match the parent card's inner radius so the blur doesn't square off corners */
  radius?: number;
  /** smaller widgets get a tighter lock badge */
  compact?: boolean;
  children: React.ReactNode;
};

export default function BlurLock({ label, sub = "Unlock with Pro", locked, radius = 14, compact = false, children }: Props) {
  const { T, themeMode, openPaywall } = useApp();
  const s = styles(T);

  if (!locked) return <>{children}</>;

  return (
    <View style={{ position: "relative", borderRadius: radius, overflow: "hidden" }}>
      <View pointerEvents="none">{children}</View>

      <BlurView
        intensity={24}
        tint={themeMode === "dark" ? "dark" : "light"}
        style={s.blur}
        pointerEvents="none"
      />

      <Pressable onPress={() => openPaywall("subscribe")} style={s.veil}>
        <View style={[s.badge, compact && { width: 28, height: 28, borderRadius: 9, marginBottom: 2 }]}>
          <Lock size={compact ? 13 : 15} color={T.ink} />
        </View>
        <Text style={[s.label, compact && { fontSize: 11.5 }]} numberOfLines={1}>{label}</Text>
        <Text style={[s.sub, compact && { fontSize: 9.5 }]} numberOfLines={1}>{sub}</Text>
      </Pressable>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    blur: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    veil: {
      position: "absolute",
      top: 0, right: 0, bottom: 0, left: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 8,
    },
    badge: {
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: T.green,
      alignItems: "center", justifyContent: "center",
      marginBottom: 3,
    },
    label: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    sub: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },
  });