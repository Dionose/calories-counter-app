// components/AmountSheet.tsx
// Changing how much of something you had.
//
// THE RULE: every option explains itself. This used to offer "a small amount /
// less than usual", "a normal serving", "a big amount" — multiplying whatever
// was there by 0.5, 1, 1.5, 2. That's abstract English pretending to be
// guidance: someone pouring hot sauce has no idea whether their pour was small
// or normal, so they picked one at random and the calorie count was fiction.
//
// Now it shows the FOOD'S OWN ladder — built in portions.ts, anchored to
// physical things. "A tablespoon (tbsp) · your whole thumb · 15 ml, about 17 g."
//
// AND EVERY RUNG COUNTS. Tap "A teaspoon" and a counter opens beneath THAT
// rung, so a label reading "2 tsp" can be entered as exactly that rather than
// approximated with a bigger unit. The counter appears under whichever rung is
// selected, so it's always where you just tapped.
import { Check, Minus, Plus, Trash2, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { Amount, rungDetail, rungLabel } from "../constants/foods";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

export type AmountResult = {
  grams: number;
  amountLabel: string;
  cal: number;
  p: number;
  c: number;
  f: number;
};

export default function AmountSheet({
  visible, name, currentGrams, currentLabel, perGram,
  amounts, onClose, onChange, onRemove,
}: {
  visible: boolean;
  name: string;
  currentGrams: number;
  currentLabel: string;
  /** per-gram nutrition, so any amount can be worked out from grams alone */
  perGram: { cal: number; p: number; c: number; f: number };
  /** THE FOOD'S OWN LADDER, with anchors and per-rung units. When absent — an
      older caller, or a food we know nothing about — the sheet falls back to
      relative sizes and says so plainly rather than pretending to be precise. */
  amounts?: Amount[];
  onClose: () => void;
  onChange: (r: AmountResult) => void;
  onRemove?: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [idx, setIdx] = useState(0);
  /* how many of the SELECTED rung. Always at least 1 — "0 teaspoons" isn't a
     thing anyone means, and removing an item has its own button. */
  const [count, setCount] = useState(1);

  /* the fallback ladder, only used when the caller gave us nothing. Relative
     to what's already there — which is honest, because that's genuinely all
     we know in this case. */
  const fallback: Amount[] = [
    { label: "Half as much", hint: `about ${Math.round(currentGrams * 0.5)} g`, grams: Math.round(currentGrams * 0.5) },
    { label: "What's shown", hint: `${Math.round(currentGrams)} g — ${currentLabel.toLowerCase()}`, grams: Math.round(currentGrams) },
    { label: "Half again as much", hint: `about ${Math.round(currentGrams * 1.5)} g`, grams: Math.round(currentGrams * 1.5) },
    { label: "Twice as much", hint: `about ${Math.round(currentGrams * 2)} g`, grams: Math.round(currentGrams * 2) },
  ];

  const list = amounts?.length ? amounts : fallback;
  const usingFallback = !amounts?.length;

  /* start on whichever rung matches what's already selected, so opening the
     sheet doesn't silently move the amount */
  useEffect(() => {
    if (!visible) return;
    setCount(1);
    const nearest = list.reduce(
      (best, a, i) => (Math.abs(a.grams - currentGrams) < Math.abs(list[best].grams - currentGrams) ? i : best),
      0
    );
    setIdx(nearest);
  }, [visible, currentGrams]);

  const chosen = list[idx] ?? list[0];
  const grams = (chosen?.grams ?? currentGrams) * count;

  const cal = Math.round(grams * perGram.cal);
  const p = Math.round(grams * perGram.p);
  const c = Math.round(grams * perGram.c);
  const f = Math.round(grams * perGram.f);

  /* "3 teaspoons" when the rung can be counted, the rung's own words when it
     can't — "2 Two tablespoons" would be nonsense, so rungs that are already
     plural carry no unit and simply aren't countable. */
  const label = chosen?.unit && count > 1 ? rungLabel(chosen, count) : chosen?.label ?? currentLabel;

  const pick = (i: number) => {
    H.tick();
    setIdx(i);
    /* a fresh rung starts at one — carrying "3" across from teaspoons to cups
       would silently triple an amount the user never chose */
    setCount(1);
  };

  const confirm = () => {
    H.success();
    onChange({ grams: Math.round(grams), amountLabel: label, cal, p, c, f });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.head}>
            <View style={{ width: 34 }} />
            <Text style={s.title} numberOfLines={1}>{name}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={s.close}>
              <X size={17} color={T.sub} />
            </Pressable>
          </View>

          <Text style={s.question}>How much did you have?</Text>
          <Text style={s.questionSub}>
            {usingFallback
              ? "Compared to what's currently logged."
              : "Each option says what it looks like. Tap one, then use + and − for more than one."}
          </Text>

          <ScrollView
            style={{ maxHeight: 380 }}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 4, gap: 9 }}
            showsVerticalScrollIndicator={false}
          >
            {list.map((a, i) => {
              const on = i === idx;
              const rowCal = Math.round(a.grams * perGram.cal);
              const countable = !!a.unit;

              return (
                <View key={`${a.label}-${i}`} style={{ gap: 8 }}>
                  <Tap onPress={() => pick(i)}>
                    <View style={[s.option, on && s.optionOn]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.optionLabel, on && { color: T.green }]}>{a.label}</Text>
                        {/* THE ANCHOR. Without it the label alone is a guess
                            dressed up as a choice. */}
                        {a.hint ? <Text style={s.optionHint}>{a.hint}</Text> : null}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.optionCal, on && { color: T.green }]}>{rowCal}</Text>
                        <Text style={s.optionCalUnit}>cal</Text>
                      </View>
                      {on && <Check size={17} color={T.green} style={{ marginLeft: 8 }} />}
                    </View>
                  </Tap>

                  {/* THE COUNTER, under the rung you just tapped. A pack saying
                      "2 tsp" needs teaspoons counted, not a tablespoon
                      approximation — so it belongs to the rung rather than
                      sitting in one fixed place at the bottom. */}
                  {on && countable && (
                    <View style={s.counter}>
                      <Pressable
                        onPress={() => { H.tick(); setCount((n) => Math.max(1, n - 1)); }}
                        style={[s.counterBtn, count <= 1 && { opacity: 0.35 }]}
                        hitSlop={8}
                        disabled={count <= 1}
                      >
                        <Minus size={18} color={T.text} />
                      </Pressable>

                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={s.counterNum}>{rungLabel(a, count)}</Text>
                        {/* ml AND grams — a pack states one or the other with
                            no consistency, so both go in */}
                        <Text style={s.counterDetail}>
                          {rungDetail(a, count, Math.round(a.grams * count * perGram.cal))}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => { H.tick(); setCount((n) => n + 1); }}
                        style={s.counterBtn}
                        hitSlop={8}
                      >
                        <Plus size={18} color={T.text} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* what the choice adds up to */}
          <View style={s.totalRow}>
            {[["Protein", p], ["Carbs", c], ["Fat", f]].map(([l, v]: any) => (
              <View key={l} style={s.totalTile}>
                <Text style={s.totalNum}>{v}g</Text>
                <Text style={s.totalLabel}>{l}</Text>
              </View>
            ))}
          </View>

          <Tap onPress={confirm} style={{ marginTop: 14 }}>
            <View style={s.saveBtn}>
              <Text style={s.saveText}>Use {label.toLowerCase()} · {cal} cal</Text>
            </View>
          </Tap>

          {onRemove && (
            <Tap onPress={() => { H.warn(); onRemove(); onClose(); }} style={{ marginTop: 10 }}>
              <View style={s.removeBtn}>
                <Trash2 size={15} color={T.red} />
                <Text style={s.removeText}>Remove this item</Text>
              </View>
            </Tap>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)" },

    sheet: {
      backgroundColor: T.bg,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      borderWidth: 1, borderBottomWidth: 0, borderColor: T.border,
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30,
    },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { flex: 1, textAlign: "center", fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },

    question: { fontSize: 20, color: T.text, fontFamily: FONTS.heading },
    questionSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 17 },

    option: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingVertical: 14, paddingHorizontal: 15,
    },
    optionOn: { borderColor: T.green, backgroundColor: T.greenBg },
    optionLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    /* the anchor line. Wraps to two lines happily — a taller row that
       explains itself beats a short one that doesn't. */
    optionHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 15.5 },
    optionCal: { fontSize: 15, color: T.sub, fontFamily: FONTS.heading },
    optionCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    /* the counter sits INSIDE the selected rung's block, indented so it reads
       as belonging to the option above rather than as a sibling of it */
    counter: {
      flexDirection: "row", alignItems: "center",
      marginLeft: 14,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    },
    counterBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    counterNum: { fontSize: 16, color: T.green, fontFamily: FONTS.heading },
    counterDetail: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginTop: 3, textAlign: "center" },

    totalRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    totalTile: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
    totalNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    totalLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },

    saveBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    saveText: { fontSize: 14.5, color: T.ink, fontFamily: FONTS.headingMed },

    removeBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
      borderRadius: 13, paddingVertical: 13,
    },
    removeText: { fontSize: 13, color: T.red, fontFamily: FONTS.headingMed },
  });