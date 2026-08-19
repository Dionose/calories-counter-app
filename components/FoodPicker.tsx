// components/FoodPicker.tsx
// Search a food, say how much, get an item back.
//
// FULL SCREEN, deliberately. A centred card fought the keyboard: the card rose,
// the keyboard covered the list, and the search field ended up half-hidden.
//
// TWO THINGS THE SEARCH HAS TO WORK AROUND.
//
// Both nutrition APIs match WHOLE WORDS. "broc" returns nothing at all, from
// either of them — you have to spell "broccoli" before anything appears. So a
// local prefix list sits in front, turning three letters into a word the
// network can actually find, and the screen says plainly that full names work
// best for anything the list doesn't cover.
//
// And amounts are WORDS, anchored to physical things — "a tablespoon (tbsp),
// your whole thumb, 15 ml about 17 g". Never "a normal serving", which is
// abstract English pretending to be guidance.
import { Bookmark, Check, ChevronLeft, Clock, Info, Minus, Plus, Search, Sparkles, Utensils, Wifi, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useApp } from "../constants/AppState";
import { searchFoods } from "../constants/foodApi";
import { prefixMatches } from "../constants/foodNames";
import { FOOD_DB, FoodDef, nutritionFor, rungDetail, rungLabel } from "../constants/foods";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

const RECENT = ["Greek yogurt", "Banana", "Black coffee"];
const SAVED = ["My morning oats", "Chicken & rice bowl"];

/* How long to wait after the last keystroke before searching.

   Without this, "chicken" fires seven requests — one per letter — and the
   answers arrive out of order, so the list flickers through partial results
   and can settle on the wrong one. 350ms is long enough to catch a normal
   typing rhythm and short enough that it still feels instant. */
const DEBOUNCE_MS = 350;

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
  /* how many of the selected rung — a label saying "2 tsp" needs exactly two
     teaspoons, not one tablespoon rounded off */
  const [count, setCount] = useState(1);

  const [remote, setRemote] = useState<FoodDef[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  /* LOCAL FIRST. The built-in foods are matched instantly with no network at
     all, and shown while the API is still thinking. Someone typing "banana"
     sees a banana immediately rather than a spinner. */
  const local = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return FOOD_DB.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.sub.toLowerCase().includes(needle)
    );
  }, [q]);

  /* WHAT THE PREFIX LIST THINKS THEY MEANT. "broc" → ["broccoli"].
     Offered as taps rather than applied silently: "cau" could reasonably mean
     cauliflower or cauliflower rice, and guessing wrong would be worse than
     the strict matching this exists to soften. */
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return prefixMatches(needle, 6).filter((h) => h !== needle);
  }, [q]);

  const list = useMemo(() => {
    const seen = new Set(local.map((f) => f.name.toLowerCase()));
    return [...local, ...remote.filter((f) => !seen.has(f.name.toLowerCase()))];
  }, [local, remote]);

  /* ---------- the debounced search ---------- */
  const timer = useRef<any>(null);
  const reqId = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const needle = q.trim();

    if (needle.length < 2) {
      setRemote([]);
      setSearching(false);
      setFailed(false);
      setSearchedFor(null);
      return;
    }

    setSearching(true);
    setFailed(false);

    timer.current = setTimeout(async () => {
      /* every request carries a number, and only the LATEST one is allowed to
         write its results. Without this, a slow early request can land after a
         fast later one and overwrite the right answer with a stale one. */
      const mine = ++reqId.current;

      let results = await searchFoods(needle);
      let usedTerm: string | null = null;

      /* THE PREFIX FALLBACK. Nothing came back for what they typed, but the
         local list recognises it as the start of a real food — so try that
         whole word instead. This is what turns "broc" into results without
         the user ever knowing the API was strict about whole words. */
      if (results.length === 0) {
        const guess = prefixMatches(needle, 1)[0];
        if (guess && guess !== needle.toLowerCase()) {
          const second = await searchFoods(guess);
          if (mine !== reqId.current) return;
          if (second.length) {
            results = second;
            usedTerm = guess;
          }
        }
      }

      if (mine !== reqId.current) return;

      setRemote(results);
      setSearchedFor(usedTerm);
      setSearching(false);
      setFailed(results.length === 0);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [q]);

  const reset = () => { setFood(null); setIdx(0); setCount(1); };
  const close = () => { reset(); setQ(""); setRemote([]); setSearchedFor(null); onClose(); };

  const openFood = (f: FoodDef) => {
    H.tap();
    setFood(f);
    setIdx(f.defaultIndex);
    setCount(1);
  };

  const confirm = () => {
    if (!food) return;
    H.success();

    const rung = food.amounts[idx];
    const grams = rung.grams * count;
    const label = rung.unit && count > 1 ? rungLabel(rung, count) : rung.label;
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
    setRemote([]);
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
              {f.sub && f.sub !== "generic" ? ` · ${f.sub}` : ""}
            </Text>
          </View>
        </View>
      </Tap>
    );
  };

  /* ---------- how much? ---------- */
  if (food) {
    const rung = food.amounts[idx];
    const countable = !!rung?.unit;
    const grams = (rung?.grams ?? 0) * count;
    const label = countable && count > 1 ? rungLabel(rung, count) : rung?.label ?? "";
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
            <Text style={s.questionSub}>
              Each option says what it looks like. Tap one, then use + and − for more than one.
            </Text>

            <View style={{ gap: 9, marginTop: 20 }}>
              {food.amounts.map((a, i) => {
                const on = i === idx;
                const rowCal = nutritionFor(food, a.grams).cal;
                const canCount = !!a.unit;

                return (
                  <View key={`${a.label}-${i}`} style={{ gap: 8 }}>
                    <Tap onPress={() => { H.tick(); setIdx(i); setCount(1); }}>
                      <View style={[s.option, on && s.optionOn]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.optionLabel, on && { color: T.green }]}>{a.label}</Text>
                          {/* THE ANCHOR — without it the label alone is a
                              guess dressed up as a choice */}
                          {a.hint ? <Text style={s.optionHint}>{a.hint}</Text> : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.optionCal, on && { color: T.green }]}>{rowCal}</Text>
                          <Text style={s.optionCalUnit}>cal</Text>
                        </View>
                        {on && <Check size={17} color={T.green} style={{ marginLeft: 8 }} />}
                      </View>
                    </Tap>

                    {/* the counter, under the rung you just tapped */}
                    {on && canCount && (
                      <View style={s.counter}>
                        <Pressable
                          onPress={() => { H.tick(); setCount((c) => Math.max(1, c - 1)); }}
                          style={[s.counterBtn, count <= 1 && { opacity: 0.35 }]}
                          hitSlop={8}
                          disabled={count <= 1}
                        >
                          <Minus size={18} color={T.text} />
                        </Pressable>

                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text style={s.counterNum}>{rungLabel(a, count)}</Text>
                          <Text style={s.counterDetail}>
                            {rungDetail(a, count, nutritionFor(food, a.grams * count).cal)}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => { H.tick(); setCount((c) => c + 1); }}
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
            </View>

            <View style={s.macroRow}>
              {[["Protein", n.p], ["Carbs", n.c], ["Fat", n.f]].map(([l, v]: any) => (
                <View key={l} style={s.macroTile}>
                  <Text style={s.macroNum}>{v}g</Text>
                  <Text style={s.macroLabel}>{l}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <Tap onPress={confirm}>
              <View style={s.addBtn}>
                <Text style={s.addBtnText}>Add {label.toLowerCase()} · {n.cal} cal</Text>
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
            {searching && <ActivityIndicator size="small" color={T.green} />}
            {q.length > 0 && !searching && (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <X size={16} color={T.micro} />
              </Pressable>
            )}
          </View>

          {/* DID YOU MEAN — offered rather than applied, since "cau" could be
              cauliflower or cauliflower rice */}
          {suggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.suggestRow}
            >
              {suggestions.map((sug) => (
                <Pressable key={sug} onPress={() => { H.tick(); setQ(sug); }} style={s.suggestChip}>
                  <Sparkles size={11} color={T.green} />
                  <Text style={s.suggestText}>{sug}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
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

              {/* THE FULL-NAME NOTE. The food database matches whole words, and
                  saying so up front costs nothing. Common foods suggest
                  themselves from the local list; this covers everything that
                  list doesn't reach. */}
              <View style={s.tipCard}>
                <View style={s.tipHead}>
                  <Info size={14} color={T.green} />
                  <Text style={s.tipTitle}>Type the food's full name</Text>
                </View>
                <Text style={s.tipBody}>
                  The food database matches whole words, so "broc" finds nothing on its own —
                  "broccoli" finds it. Common foods will suggest themselves as you type; anything
                  else needs spelling out.
                  {"\n\n"}
                  For products with long names, keep going to the end — "honey sriracha sauce"
                  works where "honey sriracha" might not. Simpler is better too: "rice" beats
                  "basmati rice pilaf".
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[s.micro, { marginBottom: 10, marginLeft: 2 }]}>
                {searching && list.length === 0
                  ? "Searching…"
                  : `${list.length} ${list.length === 1 ? "match" : "matches"} · pick the exact one`}
              </Text>

              {searchedFor && !searching && (
                <Text style={s.searchedFor}>Showing results for "{searchedFor}"</Text>
              )}

              {list.length > 0 && (
                <View style={s.group}>
                  {list.map((f, i) => (
                    <View key={`${f.name}-${i}`}>
                      {i > 0 && <View style={s.divider} />}
                      <FoodRow f={f} />
                    </View>
                  ))}
                </View>
              )}

              {/* SOME results came back, but the search is short enough that
                  there are probably better ones behind a fuller name. Said
                  quietly, below the list, so it doesn't nag. */}
              {!searching && list.length > 0 && q.trim().length < 12 && (
                <Text style={s.keepTyping}>
                  Not seeing it? Keep typing — the full name usually finds it.
                </Text>
              )}

              {searching && list.length === 0 && (
                <View style={s.searchingBox}>
                  <ActivityIndicator size="small" color={T.green} />
                  <Text style={s.searchingText}>Looking through the food database…</Text>
                </View>
              )}

              {/* NOTHING came back. Two different situations wearing the same
                  empty list, and they need different advice. */}
              {!searching && list.length === 0 && (
                <View style={s.emptyBox}>
                  {failed ? (
                    <>
                      <Wifi size={18} color={T.micro} />
                      <Text style={s.empty}>
                        Nothing came back for "{q}". Check your connection, or try the food's
                        full name — the database matches whole words, not the first few letters.
                      </Text>
                    </>
                  ) : (
                    <Text style={s.empty}>
                      Nothing matches "{q}" yet. Try the food's full name — the database matches
                      whole words, so "broc" finds nothing while "broccoli" does. For long product
                      names, type all the way to the end.
                    </Text>
                  )}
                </View>
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

    suggestRow: { gap: 7, paddingTop: 10, paddingRight: 20 },
    suggestChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7,
    },
    suggestText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
    searchedFor: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginBottom: 10, marginLeft: 2 },
    keepTyping: {
      fontSize: 11, color: T.micro, fontFamily: FONTS.body,
      textAlign: "center", marginTop: 14, lineHeight: 16,
    },

    tipCard: {
      marginTop: 22, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15,
    },
    tipHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    tipTitle: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    tipBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9, marginLeft: 2 },
    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 56 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 13 },
    rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
    rowName: { flex: 1, fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    rowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    searchingBox: { alignItems: "center", gap: 12, paddingVertical: 34 },
    searchingText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },
    emptyBox: { alignItems: "center", gap: 10, paddingVertical: 26 },
    empty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18.5, paddingHorizontal: 10 },

    /* how much */
    question: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    questionSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 18 },

    option: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingVertical: 14, paddingHorizontal: 15,
    },
    optionOn: { borderColor: T.green, backgroundColor: T.greenBg },
    optionLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    optionHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 15.5 },
    optionCal: { fontSize: 15, color: T.sub, fontFamily: FONTS.heading },
    optionCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

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

    macroRow: { flexDirection: "row", gap: 8, marginTop: 24 },
    macroTile: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    macroNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    macroLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },

    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: T.border },
    addBtn: { backgroundColor: T.green, borderRadius: 15, paddingVertical: 16, alignItems: "center" },
    addBtnText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },
  });