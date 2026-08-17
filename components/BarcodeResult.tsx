// components/BarcodeResult.tsx
// What a barcode gives you: an exact product, with the manufacturer's own
// serving size. No estimating — that's the reason to scan.
//
// Servings are phrased in the package's own unit ("1 cup", "2 cups"), not as a
// multiplier. The barcode knows a cup is 170g, so we can say so.
import { LinearGradient } from "expo-linear-gradient";
import { Check, Minus, Plus, RefreshCw, ScanBarcode, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { colorFor } from "../constants/foodColors";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

/* what the scan "found" — replaced by the Open Food Facts response, which
   carries exactly these fields plus a product photo */
const PRODUCT = {
  name: "Greek Yogurt",
  brand: "Oikos",
  variant: "Plain, Non-fat",
  colorKey: "yogurt",
  servingUnit: "cup",
  servingUnitPlural: "cups",
  servingGrams: 170,
  per: { cal: 100, p: 17, c: 6, f: 0 },   // per serving
};

/** "1 cup", "2 cups", "half a cup" — the package's own language */
function servingLabel(n: number) {
  if (n === 0.5) return `half a ${PRODUCT.servingUnit}`;
  if (n === 1) return `1 ${PRODUCT.servingUnit}`;
  if (n === 1.5) return `1½ ${PRODUCT.servingUnitPlural}`;
  const shown = Number.isInteger(n) ? n : n.toFixed(1);
  return `${shown} ${PRODUCT.servingUnitPlural}`;
}

export default function BarcodeResult({
  meal, onExit, onRescan,
}: {
  meal: string;
  onExit: () => void;
  onRescan: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);
  const [servings, setServings] = useState(1);
  const [added, setAdded] = useState(false);

  const col = colorFor(PRODUCT.colorKey);
  const n = {
    cal: Math.round(PRODUCT.per.cal * servings),
    p: Math.round(PRODUCT.per.p * servings),
    c: Math.round(PRODUCT.per.c * servings),
    f: Math.round(PRODUCT.per.f * servings),
    grams: Math.round(PRODUCT.servingGrams * servings),
  };

  const step = (d: number) => {
    H.tick();
    setServings((v) => Math.max(0.5, +(v + d).toFixed(1)));
  };

  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (added) {
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    }
  }, [added]);

  if (added) {
    return (
      <View style={s.doneWrap}>
        <Animated.View style={[s.doneCircle, { transform: [{ scale: pop }] }]}>
          <Check size={38} color={T.green} />
        </Animated.View>
        <Text style={s.doneTitle}>Added to {meal}</Text>
        <Text style={s.doneSub}>
          {servingLabel(servings)} of {PRODUCT.brand} {PRODUCT.name} · {n.cal} cal
        </Text>

        <Tap onPress={onExit} style={{ marginTop: 10, width: "100%", maxWidth: 260 }}>
          <View style={s.donePrimary}>
            <Text style={s.donePrimaryText}>Done</Text>
          </View>
        </Tap>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
      <View style={s.head}>
        <Pressable onPress={onExit} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
          <X size={22} color={T.text} />
        </Pressable>
        <Text style={s.micro}>Log {meal.toLowerCase()}</Text>
        <Pressable onPress={() => { H.tap(); onRescan(); }} hitSlop={8} style={s.rescan}>
          <RefreshCw size={12} color={T.sub} />
          <Text style={s.rescanText}>Rescan</Text>
        </Pressable>
      </View>

      {/* the reason to scan: this isn't an estimate */}
      <View style={s.exactRow}>
        <Check size={13} color={T.green} />
        <Text style={s.exactText}>EXACT MATCH · FROM BARCODE</Text>
      </View>

      <View style={s.productRow}>
        {/* the product photo lands here once Open Food Facts is wired in */}
        <LinearGradient colors={["#2E2A3A", "#1A1A1A"]} style={s.productThumb}>
          <ScanBarcode size={26} color={T.sub} />
        </LinearGradient>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.productName}>{PRODUCT.name}</Text>
          <Text style={s.productBrand}>{PRODUCT.brand} · {PRODUCT.variant}</Text>
          <Text style={s.productServing}>
            1 {PRODUCT.servingUnit} = {PRODUCT.servingGrams} g · {PRODUCT.per.cal} cal
          </Text>
        </View>
      </View>

      {/* servings in the package's own unit, because the barcode knows it */}
      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 18, alignItems: "center" }}>
          <Text style={s.micro}>How many did you have?</Text>

          <View style={s.stepRow}>
            <Pressable onPress={() => step(-0.5)} style={s.stepBtn} hitSlop={8}>
              <Minus size={19} color={T.text} />
            </Pressable>

            <View style={{ alignItems: "center", minWidth: 130 }}>
              <Text style={s.stepLabel}>{servingLabel(servings)}</Text>
              <Text style={s.stepGrams}>{n.grams} g</Text>
            </View>

            <Pressable onPress={() => step(0.5)} style={s.stepBtn} hitSlop={8}>
              <Plus size={19} color={T.text} />
            </Pressable>
          </View>
        </View>
      </TravelBorder>

      {/* the bar, same as everywhere else in the app */}
      <Text style={[s.micro, { marginTop: 20, marginBottom: 10 }]}>
        What's in it · {servingLabel(servings)}
      </Text>

      <View style={{ marginBottom: 4 }}>
        <View style={s.barHead}>
          <Text style={s.barName}>{PRODUCT.name}</Text>
          <Text style={s.barCal}>{n.cal} cal</Text>
        </View>
        <View style={s.barTrack}>
          <LinearGradient
            colors={[col.from, col.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.barFill}
          >
            <Text style={[s.barMacros, { color: col.text }]} numberOfLines={1}>
              Protein {n.p}g · Carbs {n.c}g · Fat {n.f}g
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
          <View style={{ padding: 16 }}>
            <View style={s.totalRow}>
              <Text style={s.micro}>Total</Text>
              <Text style={s.totalCal}>
                {n.cal.toLocaleString()} <Text style={s.totalUnit}>cal</Text>
              </Text>
            </View>

            <View style={s.macroTiles}>
              {[["Protein", n.p], ["Carbs", n.c], ["Fat", n.f]].map(([l, v]: any) => (
                <View key={l} style={s.macroTile}>
                  <Text style={s.macroNum}>{v}g</Text>
                  <Text style={s.macroLabel}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        </TravelBorder>
      </View>

      <Tap onPress={() => { H.success(); setAdded(true); }} style={{ marginTop: 18 }}>
        <View style={s.addBtn}>
          <Text style={s.addBtnText}>Add to {meal}</Text>
        </View>
      </Tap>

      <Text style={s.foot}>
        Straight from the label — no estimating needed.
      </Text>
    </ScrollView>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    rescan: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 9, paddingVertical: 5,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 9,
    },
    rescanText: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed },

    exactRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
    exactText: { fontSize: 10, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.body },

    productRow: { flexDirection: "row", gap: 14, marginBottom: 20 },
    productThumb: { width: 66, height: 66, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    productName: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    productBrand: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    productServing: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

    stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginTop: 12 },
    stepBtn: { width: 46, height: 46, borderRadius: 15, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    stepLabel: { fontSize: 22, color: T.green, fontFamily: FONTS.heading, textAlign: "center" },
    stepGrams: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },

    barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 },
    barName: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    barCal: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
    barTrack: { height: 28, borderRadius: 8, backgroundColor: T.track, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
    barFill: { flex: 1, borderRadius: 7, justifyContent: "center", paddingLeft: 11 },
    barMacros: { fontSize: 10, fontFamily: FONTS.headingMed },

    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    totalCal: { fontSize: 26, color: T.text, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    macroTiles: { flexDirection: "row", gap: 8, marginTop: 12 },
    macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, paddingVertical: 9, alignItems: "center" },
    macroNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    macroLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },

    addBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    addBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
    foot: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14 },

    doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, backgroundColor: T.bg },
    doneCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    doneTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    doneSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18 },
    donePrimary: { backgroundColor: T.green, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    donePrimaryText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });