// components/PageHeader.tsx
// App-wide header rule: the iso-float M sits on the LEFT, the page name is
// CENTRED, ALL CAPS, plain white. The tier lives in the M, never in the title.
//
// Colour rule:
//   PRO  → the M carries the user's current streak tier, so it changes colour
//          as they climb — Spark blue at day 1, rainbow Ultimate at 17+.
//   FREE → the M is plain green, matching the plain calendar. Tier colours are
//          a Pro feature, so the M can't leak them.
// (Onboarding is separate: those Ms are always rainbow, since there's no
//  logged-in tier yet.)
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS, tierForStreak } from "../constants/theme";
import IsoM from "./IsoM";

type Props = {
  title: string;
  /** optional element on the right — keep it small, it shares the M's column width */
  right?: React.ReactNode;
};

export default function PageHeader({ title, right }: Props) {
  const { T, freeLocked, streakDays } = useApp();
  const s = styles(T);

  const tier = tierForStreak(streakDays);
  const markColor = freeLocked ? T.green : tier.color;

  return (
    <View style={s.row}>
      <View style={s.side}>
        <IsoM size={30} color={markColor} />
      </View>

      <Text style={s.title} numberOfLines={1}>{title.toUpperCase()}</Text>

      <View style={[s.side, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    side: {
      width: 44,
      justifyContent: "center",
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      letterSpacing: 1.6,
      color: T.text,
      fontFamily: FONTS.heading,
    },
  });