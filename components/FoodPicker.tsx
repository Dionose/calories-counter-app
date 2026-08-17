// components/FoodPicker.tsx
// Search a food, say how much, get an item back.
//
// FULL SCREEN, deliberately. A centred card fought the keyboard: the card rose,
// the keyboard covered the list, and the search field ended up half-hidden.
//
// Amounts are WORDS, chosen from a list — never a number the user has to
// reason about. "Half a banana", "a small pot", "a big bowl". For foods that
// come in countable units there's also a "Something else" row for the exact
// number, so you can say "3 bananas" here rather than adding one and editing
// it afterwards.
import { Bookmark, Check, ChevronLeft, Clock, Minus, Plus, Search, Utensils, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
    KeyboardAvoidingView, Modal, Platform, Pressable,
    ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useApp } from "../constants/AppState";
import { FOOD_DB, FoodDef, countLabel, nutritionFor } from "../constants/foods";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

const RECENT = ["Greek yogurt", "Banana", "Black coffee"];
const SAVED = ["My morning oats", "Chicken & rice bowl"];

export type PickedFood = {
  name: string;
  key: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  /** the grams behind the words — so the edit sheet can re-derive everything */
  grams: number;
  /** what the user chose, in words — shown on the bar */
  amountLabel: string;
};

export default function FoodPicker({
  visible, title, onClose, onPick,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onPick: (f: PickedFood) => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [q, setQ] = useState("");
  const [food, setFood] = useState<FoodDef | null>(null);
  const [idx, setIdx] = useState(0);
  // non-null means "using the exact count instead of a listed amount"
  const [exact, setExact] = useState<number | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FOOD_DB;
    return FOOD_DB.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.sub.toLowerCase().includes(needle)
    );
  }, [q]);

  const reset = () => { setFood(null); setIdx(0); setExact(null); };
  const close = () => { reset(); setQ(""); onClose(); };

  const openFood = (f: FoodDef) => {
    H.tap();
    setFood(f);
    setIdx(f.defaultIndex);
    setExact(null);
  };

  const confirm = () => {
    if (!food) return;
    H.success();

    const grams = exact != null
      ? exact * (food.gramsPerUnit || 100)
      : food.amounts[idx].grams;
    const label = exact != null
      ? countLabel(food, Math.round(exact))
      : food.amounts[idx].label;

    const n = nutritionFor(food, grams);
    onPick({
      name: food.name,
      key: food.key,
      cal: n.cal,
      p: n.p,
      c: n.c,
      f: n.f,
      grams,
      amountLabel: label,
    });
    reset();
    setQ("");
  };

  const FoodRow = ({ f }: { f: FoodDef }) => {
    const d = f.amounts[f.defaultIndex];
    return (
      <Tap onPress={() => openFood(f)}>
        <View style={s.row}>
          <View style={s.rowIcon}>
            <Utensils size={15} color={T.micro} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowName} numberOfLines={1}>{f.name}</Text>
            <Text style={s.rowSub} numberOfLines={1}>
              {nutritionFor(f, d.grams).cal} cal for {d.label.toLowerCase()}
            </Text>
          </View>
        </View>
      </Tap>
    );
  };

  /* ---------- how much? ---------- */
  if (food) {
    const canCount = !!(food.countUnit && food.gramsPerUnit);
    const grams = exact != null
      ? exact * (food.gramsPerUnit || 100)
      : food.amounts[idx].grams;
    const label = exact != null
      ? countLabel(food, Math.round(exact))
      : food.amounts[idx].label;
    const n = nutritionFor(food, grams);

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
        <View style={s.screen}>
          <View style={s.head}>
            <Pressable onPress={() => { H.tap(); reset(); }} hitSlop={12} style={s.headBtn}>
              <ChevronLeft size={20} color={T.text} />
            </Pressable>
            <Text style={s.headTitle} numberOfLines={1}>{food.name}</Text>
            <Pressable onPress={close} hitSlop={12} style={s.headBtn}>
              <X size={19} color={T.sub} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={s.question}>How much did you have?</Text>
            <Text style={s.questionSub}>Pick whichever sounds closest — you can change it later.</Text>

            {/* every option is a sentence, not a number */}
            <View style={{ gap: 10, marginTop: 20 }}>
              {food.amounts.map((a, i) => {
                const on = exact == null && i === idx;
                const cal = nutritionFor(food, a.grams).cal;
                return (
                  <Tap key={a.label} onPress={() => { H.tick(); setExact(null); setIdx(i); }}>
                    <View style={[s.option, on && { borderColor: T.green, backgroundColor: T.greenBg }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionLabel, on && { color: T.green }]}>{a.label}</Text>
                        {a.hint ? <Text style={s.optionHint}>{a.hint}</Text> : null}
                      </View>
                      <Text style={[s.optionCal, on && { color: T.green }]}>{cal} cal</Text>
                      {on && <Check size={17} color={T.green} style={{ marginLeft: 8 }} />}
                    </View>
                  </Tap>
                );
              })}

              {/* the escape hatch — three bananas, ten eggs, four pots. Here as
                  well as in the edit sheet, so you don't have to add one and
                  then go back to correct it. */}
              {canCount && (
                exact == null ? (
                  <Tap
                    onPress={() => {
                      H.tap();
                      setExact(Math.max(1, Math.round(food.amounts[idx].grams / (food.gramsPerUnit || 1))));
                    }}
                  >
                    <View style={s.somethingElse}>
                      <Plus size={16} color={T.green} />
                      <Text style={s.somethingElseText}>
                        Something else — set the exact number of {food.countUnitPlural}
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
                      <Minus size={18} color={T.text} />
                    </Pressable>

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <Text style={s.countNum}>{countLabel(food, Math.round(exact))}</Text>
                      <Text style={s.countCal}>{n.cal} cal</Text>
                    </View>

                    <Pressable
                      onPress={() => { H.tick(); setExact((e) => Math.round((e || 0) + 1)); }}
                      style={s.countBtn}
                      hitSlop={8}
                    >
                      <Plus size={18} color={T.text} />
                    </Pressable>
                  </View>
                )
              )}
            </View>

            <View style={s.macroRow}>
              {[["Protein", n.p], ["Carbs", n.c], ["Fat", n.f]].map(([l, v]: any) => (
                <View key={l} style={s.macroTile}>
                  <Text style={s.macroNum}>{v}g</Text>
                  <Text style={s.macroLabel}>{l}</Text>
                </View>
              ))}
            </View>

            <Text style={s.gramsNote}>That's about {n.grams} g</Text>
          </ScrollView>

          <View style={s.footer}>
            <Tap onPress={confirm}>
              <View style={s.addBtn}>
                <Text style={s.addBtnText}>Add {label.toLowerCase()}</Text>
              </View>
            </Tap>
          </View>
        </View>
      </Modal>
    );
  }

  /* ---------- search ---------- */
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.head}>
          <View style={{ width: 38 }} />
          <Text style={s.headTitle}>{title || "Add an item"}</Text>
          <Pressable onPress={close} hitSlop={12} style={s.headBtn}>
            <X size={19} color={T.sub} />
          </Pressable>
        </View>

        {/* pinned above the list — never scrolls away, never hides */}
        <View style={s.searchWrap}>
          <View style={s.searchBox}>
            <Search size={17} color={T.micro} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search any food…"
              placeholderTextColor={T.micro}
              style={s.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <X size={16} color={T.micro} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {q.length === 0 ? (
            <>
              <View style={s.sectionRow}>
                <Bookmark size={12} color={T.green} />
                <Text style={s.micro}>Your saved meals</Text>
              </View>
              <View style={s.group}>
                {SAVED.map((name, i) => (
                  <View key={name}>
                    {i > 0 && <View style={s.divider} />}
                    <Tap onPress={() => H.tap()}>
                      <View style={s.row}>
                        <View style={s.rowIcon}>
                          <Utensils size={15} color={T.micro} />
                        </View>
                        <Text style={s.rowName}>{name}</Text>
                      </View>
                    </Tap>
                  </View>
                ))}
              </View>

              <View style={[s.sectionRow, { marginTop: 18 }]}>
                <Clock size={12} color={T.sub} />
                <Text style={s.micro}>Recent</Text>
              </View>
              <View style={s.group}>
                {RECENT.map((name, i) => {
                  const f = FOOD_DB.find((d) => d.name === name);
                  if (!f) return null;
                  return (
                    <View key={name}>
                      {i > 0 && <View style={s.divider} />}
                      <FoodRow f={f} />
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={[s.micro, { marginBottom: 10, marginLeft: 2 }]}>
                {list.length} {list.length === 1 ? "match" : "matches"} · pick the exact one
              </Text>
              <View style={s.group}>
                {list.map((f, i) => (
                  <View key={f.name}>
                    {i > 0 && <View style={s.divider} />}
                    <FoodRow f={f} />
                  </View>
                ))}
              </View>

              {list.length === 0 && (
                <Text style={s.empty}>
                  Nothing matches "{q}". Try a simpler word — "rice" rather than "basmati rice pilaf".
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    head: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    },
    headBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    headTitle: { flex: 1, textAlign: "center", fontSize: 17, color: T.text, fontFamily: FONTS.heading },

    searchWrap: { paddingHorizontal: 20, paddingBottom: 14 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    },
    searchInput: { flex: 1, fontSize: 15, color: T.text, fontFamily: FONTS.headingMed, padding: 0 },

    sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9, marginLeft: 2 },
    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 56 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 13 },
    rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
    rowName: { flex: 1, fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    rowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    empty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", paddingVertical: 26, lineHeight: 18 },

    /* how much */
    question: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    questionSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 18 },

    option: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingVertical: 15, paddingHorizontal: 16,
    },
    optionLabel: { fontSize: 15.5, color: T.text, fontFamily: FONTS.headingMed },
    optionHint: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    optionCal: { fontSize: 13, color: T.sub, fontFamily: FONTS.heading },

    somethingElse: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderStyle: "dashed",
      borderRadius: 15, paddingVertical: 15, paddingHorizontal: 16,
    },
    somethingElseText: { flex: 1, fontSize: 13.5, color: T.green, fontFamily: FONTS.headingMed },
    countBtn: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    countNum: { fontSize: 19, color: T.green, fontFamily: FONTS.heading },
    countCal: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    macroRow: { flexDirection: "row", gap: 8, marginTop: 24 },
    macroTile: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    macroNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    macroLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },
    gramsNote: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14 },

    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: T.border },
    addBtn: { backgroundColor: T.green, borderRadius: 15, paddingVertical: 16, alignItems: "center" },
    addBtnText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
  });