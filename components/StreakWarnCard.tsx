// components/StreakWarnCard.tsx
// Sits at the bottom of Calendar. Two states:
//   in-window  — counts down to the day colours fade, opens the reel
//   locked     — colours already gone, goes straight to the paywall
// Free users only; Pro users never see it.
import { Bell, ChevronRight, Crown } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function StreakWarnCard({
  daysLeft,
  fadeDate,
  onTap,
}: {
  /** days until colours fade; 0 or less means already locked */
  daysLeft: number;
  fadeDate: Date;
  onTap: () => void;
}) {
  const { T, openPaywall } = useApp();
  const s = styles(T);
  const locked = daysLeft <= 0;

  if (locked) {
    return (
      <Tap onPress={() => openPaywall("subscribe")} style={{ marginTop: 20 }}>
        <View style={s.card}>
          <View style={s.headRow}>
            <Crown size={22} color={T.gold} />
            <Text style={s.title}>Your streak colours are locked</Text>
          </View>
          <Text style={s.body}>
            You're still on a streak — it's counting in the background. Subscribe to Pro to bring back
            your tiers, colours and Ultimate rank, right where you left off.
          </Text>
          <View style={s.goldCta}>
            <Text style={s.goldCtaText}>Keep my colours — go Pro</Text>
          </View>
        </View>
      </Tap>
    );
  }

  return (
    <Tap onPress={onTap} style={{ marginTop: 20 }}>
      <View style={s.card}>
        <View style={s.headRow}>
          <View style={s.bellChip}>
            <Bell size={14} color={T.gold} />
          </View>
          <Text style={s.title}>
            Your streak colours fade in {daysLeft} day{daysLeft === 1 ? "" : "s"}
          </Text>
        </View>
        <Text style={s.body}>
          On <Text style={s.bodyBold}>{MSHORT[fadeDate.getMonth()]} {fadeDate.getDate()}</Text>, your
          colours, tiers and rank won't show anymore. Your streak keeps going — you just won't see it
          in colour.
        </Text>
        <View style={s.ghostCta}>
          <Text style={s.ghostCtaText}>Tap to see what happens →</Text>
          <ChevronRight size={15} color={T.micro} />
        </View>
      </View>
    </Tap>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    card: { backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}55`, borderRadius: 16, padding: 16 },
    headRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 },
    bellChip: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(251,191,36,0.12)", alignItems: "center", justifyContent: "center" },
    title: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed, flex: 1 },
    body: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5, marginBottom: 12 },
    bodyBold: { color: T.text, fontFamily: FONTS.headingMed },

    ghostCta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
    ghostCtaText: { fontSize: 12.5, color: T.green, fontFamily: FONTS.headingMed },

    goldCta: { alignItems: "center", backgroundColor: T.gold, borderRadius: 11, paddingVertical: 12 },
    goldCtaText: { fontSize: 12.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  });