// components/BarcodeResult.tsx
// What a barcode scan lands on — a real product, looked up by its digits.
//
// The whole point of this path is that nothing is estimated. Open Food Facts
// returns what's printed on the packet, so the numbers are as exact as the
// manufacturer's own label. That's why the header says EXACT rather than
// MOTION AI: an estimate and a label reading are different kinds of claim,
// and the app shouldn't blur them.
//
// THE AMOUNT CARRIES THAT DISTINCTION TOO. One rung may be gold — the pack's
// own stated serving, measured rather than converted by us. Our version of the
// same measure is removed upstream, so there's never a choice between two
// half-cups with different calorie counts.
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, BadgeCheck, Check, ChevronRight, Minus, Plus, ScanLine, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { lookupBarcode } from "../constants/foodApi";
import { colorFor } from "../constants/foodColors";
import { FoodDef, nutritionFor, rungDetail, rungLabel } from "../constants/foods";
import * as H from "../constants/haptics";
import { saveMeal } from "../constants/meals";
import { FONTS } from "../constants/theme";
import AmountSheet from "./AmountSheet";
import Icon from "./Icon";
import { IsoMGlow } from "./IsoM";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

/* ---------- the lookup animation ---------- */
function Looking({ code }: { code?: string | null }) {
  const { T } = useApp();
  const s = styles(T);
  return (
    <View style={s.centre}>
      <IsoMGlow size={92} />
      <Text style={s.centreText}>Looking up the label…</Text>
      {code ? <Text style={s.centreCode}>{code}</Text> : null}
    </View>
  );
}

/* ---------- one nutrient bar ---------- */
function Bar({ label, grams, cal, colorKey, delay }: {
  label: string;
  grams: number;
  cal: number;
  colorKey: string;
  delay: number;
}) {
  const { T } = useApp();
  const s = styles(T);
  const col = colorFor(colorKey);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: 560,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  /* proportion of the item's calories this macro accounts for — protein and
     carbs are 4 cal a gram, fat is 9. Never below 26% or the label won't fit. */
  const target = Math.max(26, Math.min(100, cal > 0 ? (grams * (label === "Fat" ? 9 : 4) / cal) * 100 : 26));
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${target}%`] });

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={s.barHead}>
        <Text style={s.barName}>{label}</Text>
        <Text style={s.barGrams}>{grams}g</Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={{ width, height: "100%" }}>
          <LinearGradient
            colors={[col.from, col.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.barFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export default function BarcodeResult({
  meal, code, onExit, onRescan,
}: {
  meal: string;
  /** the digits the scanner read. null means we got here without a scan. */
  code?: string | null;
  onExit: () => void;
  onRescan: () => void;
}) {
  const { T, userId, refreshStreak } = useApp();
  const s = styles(T);

  const [food, setFood] = useState<FoodDef | null>(null);
  const [looking, setLooking] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [idx, setIdx] = useState(0);
  /* how many of the selected rung — a pack saying "2 tsp" needs exactly two
     teaspoons, not one tablespoon rounded off */
  const [count, setCount] = useState(1);
  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /* ---------- THE LOOKUP ----------
     Open Food Facts is community-maintained, which means coverage is very good
     for mass-market products and patchy for local or own-brand ones. A miss is
     a normal outcome, not an error — so it gets its own screen rather than a
     scary message.

     lookupBarcode also returns null for anything that ISN'T FOOD. The scanner
     will happily read a can of bug spray, and anything you leave open, someone
     will point at exactly that. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!code) { setLooking(false); setNotFound(true); return; }

      const f = await lookupBarcode(code);
      if (cancelled) return;

      if (!f) {
        setLooking(false);
        setNotFound(true);
        return;
      }

      setFood(f);
      setIdx(f.defaultIndex);
      setCount(1);
      setLooking(false);
      H.success();
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (looking) return <Looking code={code} />;

  /* ---------- not in the database, or not food ---------- */
  if (notFound || !food) {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
          <View style={s.head}>
            <Pressable onPress={onExit} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
              <X size={22} color={T.text} />
            </Pressable>
            <Text style={s.micro}>Log {meal.toLowerCase()}</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={s.missWrap}>
            <View style={s.missIcon}>
              <ScanLine size={30} color={T.sub} />
            </View>

            <Text style={s.missTitle}>Nothing edible came back</Text>

            <Text style={s.missBody}>
              Either that product isn't in the food database, or it isn't food. The database is
              built by volunteers, so it covers most supermarket brands but misses local products
              and own-brand items.
              {code ? `\n\nScanned: ${code}` : ""}
            </Text>

            <Text style={s.missBody}>
              If it is food, searching by name usually works — the nutrition will be close even
              when the exact brand isn't listed.
            </Text>

            <Tap onPress={onRescan} style={{ width: "100%", marginTop: 20 }}>
              <View style={s.missPrimary}>
                <Text style={s.missPrimaryText}>Scan another barcode</Text>
              </View>
            </Tap>

            <Tap onPress={onExit} style={{ width: "100%", marginTop: 10 }}>
              <View style={s.missGhost}>
                <Text style={s.missGhostText}>Search for it by name instead</Text>
              </View>
            </Tap>
          </View>
        </ScrollView>
      </View>
    );
  }

  const rung = food.amounts[idx] ?? food.amounts[0];
  const countable = !!rung?.unit;
  const gold = !!rung?.exact;
  const grams = (rung?.grams ?? 0) * count;
  const label = countable && count > 1 ? rungLabel(rung, count) : rung?.label ?? "";
  const n = nutritionFor(food, grams);

  /* ---------- THE WRITE ---------- */
  const logIt = async () => {
    if (saving) return;
    if (!userId) { setSaveErr("You're signed out — sign in and try again."); return; }

    setSaveErr(null);
    setSaving(true);

    const { error } = await saveMeal(userId, {
      mealType: meal.toLowerCase() as any,
      source: "barcode",
      items: [{
        foodName: food.name,
        amountLabel: label,
        grams,
        calories: n.cal,
        protein: n.p,
        carbs: n.c,
        fat: n.f,
        /* marked as a LABEL reading rather than an estimate — worth keeping
           separate, since these are the only numbers in the app that came off
           a manufacturer's packaging */
        source: "barcode",
      }],
    });

    setSaving(false);

    if (error) {
      setSaveErr(error);
      H.warn();
      return;
    }

    refreshStreak();
    H.success();
    setDone(true);
  };

  /* ---------- logged ---------- */
  if (done) {
    return (
      <View style={s.doneWrap}>
        <View style={s.doneCircle}>
          <Check size={38} color={T.green} />
        </View>
        <Text style={s.doneTitle}>Added to {meal}</Text>
        <Text style={s.doneSub}>{food.name} · {n.cal} cal</Text>

        <Tap onPress={onRescan} style={{ marginTop: 18, width: "100%", maxWidth: 260 }}>
          <View style={s.doneGhost}>
            <Text style={s.doneGhostText}>Scan another</Text>
          </View>
        </Tap>

        <Tap onPress={onExit} style={{ marginTop: 10, width: "100%", maxWidth: 260 }}>
          <View style={s.donePrimary}>
            <Text style={s.donePrimaryText}>Done</Text>
          </View>
        </Tap>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
        <View style={s.head}>
          <Pressable onPress={onExit} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
            <X size={22} color={T.text} />
          </Pressable>
          <Text style={s.micro}>Log {meal.toLowerCase()}</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* EXACT, not estimated — the distinction matters enough to say */}
        <View style={s.exactRow}>
          <Icon name="barcode" size={15} mode="loop" />
          <Text style={s.exactText}>EXACT · FROM THE LABEL</Text>
        </View>

        <Text style={s.productName}>{food.name}</Text>
        {code ? <Text style={s.codeLine}>Barcode {code}</Text> : null}

        {/* the amount, in words, WITH its anchor. GOLD when it's the pack's own
            stated serving rather than our conversion — a different kind of
            claim, and the one worth picking. */}
        <Tap onPress={() => { H.tap(); setEditing(true); }} style={{ marginTop: 18 }}>
          <View style={[s.amountRow, gold && s.amountRowGold]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {gold ? (
                <View style={s.exactTag}>
                  <BadgeCheck size={11} color={T.gold} />
                  <Text style={s.exactTagText}>EXACTLY AS THE PACK STATES IT</Text>
                </View>
              ) : (
                <Text style={s.micro}>How much</Text>
              )}

              <Text style={[s.amountLabel, gold && { color: T.gold }]}>{label}</Text>

              <Text style={s.amountHint}>
                {count > 1 || !rung?.hint
                  ? rungDetail(rung, count, n.cal).replace(/^\d+ cal · /, "")
                  : rung.hint}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.amountCal, gold && { color: T.gold }]}>{n.cal}</Text>
              <Text style={s.amountCalUnit}>cal</Text>
            </View>
            <ChevronRight size={18} color={T.micro} style={{ marginLeft: 6 }} />
          </View>
        </Tap>

        {/* THE COUNTER for whatever rung is selected. A pack reading "2 tsp"
            needs teaspoons counted, not a tablespoon approximation. */}
        {countable && (
          <View style={[s.countRow, gold && s.countRowGold]}>
            <Pressable
              onPress={() => { H.tick(); setCount((c) => Math.max(1, c - 1)); }}
              style={[s.countBtn, count <= 1 && { opacity: 0.35 }]}
              hitSlop={8}
              disabled={count <= 1}
            >
              <Minus size={18} color={T.text} />
            </Pressable>

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={[s.countNum, gold && { color: T.gold }]}>{rungLabel(rung, count)}</Text>
              <Text style={s.countCal}>{rungDetail(rung, count, n.cal)}</Text>
            </View>

            <Pressable
              onPress={() => { H.tick(); setCount((c) => c + 1); }}
              style={s.countBtn}
              hitSlop={8}
            >
              <Plus size={18} color={T.text} />
            </Pressable>
          </View>
        )}

        <Text style={s.changeHint}>Tap the amount above to pick a different measure</Text>

        <Text style={[s.micro, { marginTop: 22, marginBottom: 12 }]}>What's in it</Text>

        <Bar label="Protein" grams={n.p} cal={n.cal} colorKey="chicken" delay={0} />
        <Bar label="Carbs" grams={n.c} cal={n.cal} colorKey="rice" delay={120} />
        <Bar label="Fat" grams={n.f} cal={n.cal} colorKey="oil" delay={240} />

        {/* the total */}
        <View style={{ marginTop: 8, marginBottom: 14 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
            <View style={{ padding: 16 }}>
              <View style={s.totalRow}>
                <Text style={s.micro}>Total</Text>
                <Text style={s.totalCal}>
                  {n.cal.toLocaleString()} <Text style={s.totalUnit}>cal</Text>
                </Text>
              </View>
              <Text style={s.per100}>
                {food.per100} cal per 100 g · {food.p}g protein · {food.c}g carbs · {food.f}g fat
              </Text>
            </View>
          </TravelBorder>
        </View>

        {saveErr ? (
          <View style={s.errRow}>
            <AlertTriangle size={14} color={T.red} />
            <Text style={s.errText}>{saveErr}</Text>
          </View>
        ) : null}

        <Tap onPress={logIt}>
          <View style={[s.logBtn, saving && { opacity: 0.6 }]}>
            <Text style={s.logBtnText}>{saving ? "Logging…" : `Log to ${meal}`}</Text>
          </View>
        </Tap>

        <Tap onPress={onRescan} style={{ marginTop: 10 }}>
          <View style={s.rescanBtn}>
            <Text style={s.rescanText}>Scan a different product</Text>
          </View>
        </Tap>
      </ScrollView>

      {/* change the amount — THE FOOD'S OWN LADDER goes in, so every option
          arrives with its anchor, its counter, and the gold rung on top */}
      {editing && (
        <AmountSheet
          visible
          name={food.name}
          currentGrams={grams}
          currentLabel={label}
          perGram={{
            cal: food.per100 / 100,
            p: food.p / 100,
            c: food.c / 100,
            f: food.f / 100,
          }}
          amounts={food.amounts}
          onClose={() => setEditing(false)}
          onChange={(r) => {
            /* map the chosen grams back onto the nearest rung and work out how
               many of it that was, so this screen's counter agrees with what
               the sheet just showed */
            const nearest = food.amounts.reduce(
              (best, a, i) =>
                Math.abs(a.grams - r.grams) < Math.abs(food.amounts[best].grams - r.grams) ? i : best,
              0
            );
            const per = food.amounts[nearest].grams || 1;
            setIdx(nearest);
            setCount(Math.max(1, Math.round(r.grams / per)));
          }}
          onRemove={onExit}
        />
      )}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: T.bg },
    centreText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    centreCode: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, letterSpacing: 1 },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },

    exactRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    exactText: { fontSize: 10, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.body },
    productName: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, lineHeight: 28 },
    codeLine: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 4, letterSpacing: 0.5 },

    amountRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 16, padding: 16,
    },
    /* GOLD — the pack's own number rather than our conversion of it */
    amountRowGold: {
      borderColor: `${T.gold}66`,
      backgroundColor: "rgba(251,191,36,0.07)",
    },
    exactTag: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
    exactTagText: { fontSize: 8.5, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    amountLabel: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginTop: 4 },
    /* the anchor line — wraps freely, because a taller row that explains
       itself beats a short one that doesn't */
    amountHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 15.5 },
    amountCal: { fontSize: 17, color: T.green, fontFamily: FONTS.heading },
    amountCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    countRow: {
      flexDirection: "row", alignItems: "center", marginTop: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 15, paddingVertical: 11, paddingHorizontal: 13,
    },
    countRowGold: {
      backgroundColor: "rgba(251,191,36,0.07)",
      borderColor: `${T.gold}55`,
    },
    countBtn: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    countNum: { fontSize: 17, color: T.green, fontFamily: FONTS.heading },
    countCal: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3, textAlign: "center" },
    changeHint: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 10 },

    barHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    barName: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    barGrams: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed },
    barTrack: { height: 20, borderRadius: 7, backgroundColor: T.track, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
    barFill: { flex: 1, borderRadius: 6 },

    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    totalCal: { fontSize: 26, color: T.text, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    per100: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 8, lineHeight: 15 },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    logBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    logBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
    rescanBtn: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, alignItems: "center",
    },
    rescanText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },

    /* not found */
    missWrap: { alignItems: "center", paddingTop: 30, gap: 12 },
    missIcon: {
      width: 62, height: 62, borderRadius: 20,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    missTitle: { fontSize: 18, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    missBody: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19.5 },
    missPrimary: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    missPrimaryText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
    missGhost: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, alignItems: "center",
    },
    missGhostText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },

    /* logged */
    doneWrap: {
      flex: 1, backgroundColor: T.bg,
      alignItems: "center", justifyContent: "center", gap: 12, padding: 24,
    },
    doneCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    doneTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    doneSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center" },
    doneGhost: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13, paddingVertical: 13, alignItems: "center",
    },
    doneGhostText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
    donePrimary: { backgroundColor: T.green, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    donePrimaryText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });