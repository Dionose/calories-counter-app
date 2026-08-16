// components/Paywall.tsx
// THE paywall. Every locked thing in the app is a door to this one screen —
// every crown, every blur-lock, the calendar go-Pro button, the Profile
// upgrade card. Rendered once globally (app/_layout.tsx) so any screen can
// call openPaywall() and have it appear.
//
// Two variants of the same shell, chosen by trial eligibility:
//   "trial"     — first-timer: 3 days free, then $9.99/mo
//   "subscribe" — already used the trial: no trial language at all
import { Check, Crown, Shield, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";
import { IsoMGlow } from "./IsoM";

const PLANS = [
  { id: "monthly", name: "Monthly", price: "$9.99", per: "/mo", sub: "Billed monthly", badge: null as string | null, glow: "#FB923C" },
  { id: "yearly", name: "Yearly", price: "$99.99", per: "/yr", sub: "Save ~17% vs monthly", badge: "Popular", glow: "#FBBF24" },
  { id: "lifetime", name: "Lifetime", price: "$499.99", per: "once", sub: "Pay once — yours for life", badge: "Best value", glow: "#FDE68A" },
];

const FEATURES = [
  "Unlimited photo logging",
  "Motion Voice AI — describe meals, no typing",
  "Barcode scanner for exact facts",
  "Full history & tier colours",
  "Leaderboard & streak badges",
  "Expected weight & consistency tracking",
];

export default function Paywall() {
  const { T, paywallOpen, paywallVariant, closePaywall, setIsPro } = useApp();
  const [plan, setPlan] = useState("yearly");

  const s = styles(T);
  const isTrial = paywallVariant === "trial";
  const P = PLANS.find((p) => p.id === plan)!;

  const cta = isTrial
    ? "Start free trial"
    : plan === "lifetime"
      ? "Get Lifetime — $499.99"
      : `Subscribe · ${P.price}${P.per}`;

  // real billing lands at backend phase — for now this just unlocks Pro
  const buy = () => {
    setIsPro(true);
    closePaywall();
  };

  return (
    <Modal visible={paywallOpen} animationType="slide" onRequestClose={closePaywall}>
      <View style={s.screen}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.markWrap}>
            <IsoMGlow size={86} />
          </View>

          <Text style={s.title}>
            {isTrial ? "Start your 3-day\nfree trial" : "Unlock MOTION Pro"}
          </Text>
          <Text style={s.sub}>
            {isTrial
              ? "Then $9.99 US/month. Cancel anytime before day 4 and you won't be charged."
              : "Everything Motion can do, with nothing held back."}
          </Text>

          <View style={s.featureCard}>
            {FEATURES.map((f, k) => (
              <View key={k} style={s.featureRow}>
                <View style={s.featureCheck}><Check size={12} color="#0A0A0A" /></View>
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.micro, { marginTop: 22, marginBottom: 10 }]}>Choose your plan</Text>
          {PLANS.map((pl) => {
            const on = plan === pl.id;
            return (
              <Pressable
                key={pl.id}
                onPress={() => setPlan(pl.id)}
                style={[s.planRow, { borderColor: on ? T.green : T.border, backgroundColor: on ? T.greenBg : T.card }]}
              >
                <View style={[s.planCrown, { backgroundColor: pl.glow }]}>
                  <Crown size={16} color="#0A0A0A" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowCenter}>
                    <Text style={s.planName}>Pro · {pl.name}</Text>
                    {pl.badge && <View style={s.planBadge}><Text style={s.planBadgeText}>{pl.badge}</Text></View>}
                  </View>
                  <Text style={s.planSub}>{pl.sub}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.planPrice}>{pl.price}</Text>
                  <Text style={s.planPer}>{pl.per}</Text>
                </View>
              </Pressable>
            );
          })}

          {isTrial && (
            <View style={s.timeline}>
              <Text style={s.timelineText}>
                Today: full access · Day 3: reminder · Day 4: $9.99 US/month begins unless you cancel
              </Text>
            </View>
          )}

          <View style={s.note}>
            <Shield size={13} color={T.green} />
            <Text style={s.noteText}>
              All plans unlock the same Pro — cancel monthly or yearly anytime; lifetime is a one-time payment.
            </Text>
          </View>

          <Pressable onPress={buy} style={s.cta}>
            <Text style={s.ctaText}>{cta}</Text>
          </Pressable>

          <Pressable onPress={closePaywall} style={s.maybeBtn}>
            <Text style={s.maybe}>Maybe later</Text>
          </Pressable>

          <Pressable style={{ alignItems: "center", marginTop: 16, padding: 8 }}>
            <Text style={s.restore}>Restore purchases</Text>
          </Pressable>
        </ScrollView>

        {/* close — bare X, no chrome. Sits OUTSIDE the ScrollView with a 40px
            invisible touch area so nothing competes for the tap. */}
        <Pressable onPress={closePaywall} hitSlop={16} style={s.close}>
          <X size={22} color={T.sub} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    scroll: { padding: 22, paddingTop: 96, paddingBottom: 48 },

    close: {
      position: "absolute",
      top: 54,
      right: 16,
      zIndex: 50,
      elevation: 50,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },

    markWrap: { alignItems: "center", marginBottom: 4 },
    title: { fontSize: 28, color: T.text, fontFamily: FONTS.heading, textAlign: "center", lineHeight: 34 },
    sub: { fontSize: 13.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginTop: 10, lineHeight: 20 },
    micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowCenter: { flexDirection: "row", alignItems: "center", gap: 5 },

    featureCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 17, marginTop: 22, gap: 12 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    featureCheck: { width: 20, height: 20, borderRadius: 7, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
    featureText: { flex: 1, fontSize: 13, color: T.text, fontFamily: FONTS.body },

    planRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, borderWidth: 1.5, marginBottom: 9 },
    planCrown: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    planName: { fontSize: 14, color: T.text, fontFamily: FONTS.heading },
    planBadge: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
    planBadgeText: { fontSize: 8.5, color: T.green, fontFamily: FONTS.heading },
    planSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 1 },
    planPrice: { fontSize: 14.5, color: T.text, fontFamily: FONTS.heading },
    planPer: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },

    timeline: { backgroundColor: T.cardHi, borderRadius: 12, padding: 12, marginTop: 6 },
    timelineText: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, lineHeight: 16, textAlign: "center" },

    note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    noteText: { flex: 1, fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15 },

    cta: { backgroundColor: T.green, borderRadius: 15, padding: 16, alignItems: "center", marginTop: 20 },
    ctaText: { color: T.ink, fontFamily: FONTS.heading, fontSize: 15 },
    maybeBtn: { alignItems: "center", marginTop: 8, paddingVertical: 12 },
    maybe: { fontSize: 13.5, color: T.sub, fontFamily: FONTS.headingMed },
    restore: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body },
  });