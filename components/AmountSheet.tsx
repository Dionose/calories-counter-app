// components/AmountSheet.tsx
// "How much did you have?" — one sheet, shared by the result screen's edit and
// anywhere else that needs to change an amount.
//
// Pulled out of ResultFlow because the exact-number path made it big enough to
// own a file, and the picker will want the same behaviour.
import { Check, Minus, Plus, Trash2, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { Amount, FoodDef, GENERIC_AMOUNTS, countLabel, findFood } from "../constants/foods";
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
  visible, name, currentGrams, currentLabel,
  perGram, onClose, onChange, onRemove,
}: {
  visible: boolean;
  name: string;
  currentGrams: number;
  currentLabel: string;
  /** used when the food isn't in the database, so editing still scales right */
  perGram: { cal: number; p: number; c: number; f: number };
  onClose: () => void;
  onChange: (r: AmountResult) => void;
  onRemove?: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const food: FoodDef | undefined = findFood(name);
  const amounts: Amount[] = food ? food.amounts : GENERIC_AMOUNTS;
  const canCount = !!(food && food.countUnit && food.gramsPerUnit);

  const [idx, setIdx] = useState(0);
  // -1 means "using the exact number instead of a listed amount"
  const [exact, setExact] = useState<number | null>(null);

  useEffect(() => {
    const i = amounts.findIndex((a) => Math.abs(a.grams - currentGrams) < 1);
    setIdx(i === -1 ? 0 : i);
    setExact(null);
  }, [visible, name, currentGrams]);

  const gramsOf = (a: number) => a;
  const chosenGrams = exact != null && canCount
    ? exact * (food!.gramsPerUnit || 100)
    : amounts[idx]?.grams ?? currentGrams;

  const chosenLabel = exact != null && canCount
    ? countLabel(food!, exact)
    : amounts[idx]?.label ?? currentLabel;

  const calc = (grams: number) => ({
    cal: Math.round(perGram.cal * grams),
    p: Math.round(perGram.p * grams),
    c: Math.round(perGram.c * grams),
    f: Math.round(perGram.f * grams),
  });

  const preview = calc(chosenGrams);

  const save = () => {
    H.success();
    onChange({ grams: chosenGrams, amountLabel: chosenLabel, ...preview });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.grabber} />

          {/* a way out that doesn't require choosing something */}
          <View style={s.headRow}>
            <View style={s.hintPill}>
              <Text style={s.hintText}>Tap anywhere outside to close</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <X size={17} color={T.sub} />
            </Pressable>
          </View>

          <Text style={s.title}>{name}</Text>
          <Text style={s.sub}>
            MOTION thought this was {currentLabel.toLowerCase()}. How much did you really have?
          </Text>

          <ScrollView style={{ maxHeight: 300, marginTop: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 9 }}>
              {amounts.map((a, i) => {
                const on = exact == null && i === idx;
                return (
                  <Tap key={a.label} onPress={() => { H.tick(); setExact(null); setIdx(i); }}>
                    <View style={[s.option, on && { borderColor: T.green, backgroundColor: T.greenBg }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionLabel, on && { color: T.green }]}>{a.label}</Text>
                        {a.hint ? <Text style={s.optionHint}>{a.hint}</Text> : null}
                      </View>
                      <Text style={[s.optionCal, on && { color: T.green }]}>{calc(a.grams).cal} cal</Text>
                      {on && <Check size={16} color={T.green} style={{ marginLeft: 8 }} />}
                    </View>
                  </Tap>
                );
              })}

              {/* the escape hatch — ten eggs, seven slices */}
              {canCount && (
                exact == null ? (
                  <Tap onPress={() => { H.tap(); setExact((amounts[idx]?.grams ?? 60) / (food!.gramsPerUnit || 60)); }}>
                    <View style={s.somethingElse}>
                      <Plus size={15} color={T.green} />
                      <Text style={s.somethingElseText}>
                        Something else — set the exact number of {food!.countUnitPlural}
                      </Text>
                    </View>
                  </Tap>
                ) : (
                  <View style={[s.option, { borderColor: T.green, backgroundColor: T.greenBg, paddingVertical: 12 }]}>
                    <Pressable
                      onPress={() => { H.tick(); setExact((e) => Math.max(1, Math.round((e || 1) - 1))); }}
                      style={s.countBtn}
                      hitSlop={8}
                    >
                      <Minus size={17} color={T.text} />
                    </Pressable>

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <Text style={s.countNum}>{countLabel(food!, Math.round(exact))}</Text>
                      <Text style={s.countCal}>{preview.cal} cal</Text>
                    </View>

                    <Pressable
                      onPress={() => { H.tick(); setExact((e) => Math.round((e || 0) + 1)); }}
                      style={s.countBtn}
                      hitSlop={8}
                    >
                      <Plus size={17} color={T.text} />
                    </Pressable>
                  </View>
                )
              )}
            </View>
          </ScrollView>

          <View style={s.macros}>
            {[["Protein", preview.p], ["Carbs", preview.c], ["Fat", preview.f]].map(([l, v]: any) => (
              <View key={l} style={s.macroTile}>
                <Text style={s.macroNum}>{v}g</Text>
                <Text style={s.macroLabel}>{l}</Text>
              </View>
            ))}
          </View>

          <Tap onPress={save} style={{ marginTop: 16 }}>
            <View style={s.saveBtn}>
              <Text style={s.saveText}>Set to {chosenLabel.toLowerCase()}</Text>
            </View>
          </Tap>

          {onRemove && (
            <Tap onPress={() => { H.warn(); onRemove(); onClose(); }} style={{ marginTop: 10 }}>
              <View style={s.removeBtn}>
                <Trash2 size={15} color={T.red} />
                <Text style={s.removeText}>I didn't have this</Text>
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
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      marginTop: "auto", backgroundColor: T.bg,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: T.border,
      paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30,
    },
    grabber: { width: 38, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginBottom: 14 },

    headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    hintPill: {
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6,
    },
    hintText: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body },
    closeBtn: {
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },

    title: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    sub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 5, lineHeight: 18 },

    option: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15,
    },
    optionLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    optionHint: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    optionCal: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.heading },

    somethingElse: {
      flexDirection: "row", alignItems: "center", gap: 9,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderStyle: "dashed",
      borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15,
    },
    somethingElseText: { flex: 1, fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },
    countBtn: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    countNum: { fontSize: 18, color: T.green, fontFamily: FONTS.heading },
    countCal: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 1 },

    macros: { flexDirection: "row", gap: 8, marginTop: 16 },
    macroTile: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 11, paddingVertical: 9, alignItems: "center" },
    macroNum: { fontSize: 14, color: T.text, fontFamily: FONTS.heading },
    macroLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },

    saveBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    saveText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
    removeBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
      borderRadius: 13, paddingVertical: 12,
    },
    removeText: { fontSize: 13, color: T.red, fontFamily: FONTS.headingMed },
  });