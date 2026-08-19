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
//
// THE SEARCH IS REAL. Typing hits USDA (generic foods) and Open Food Facts
// (packaged products). But both APIs match WHOLE WORDS — "broc" returns
// nothing at all — so a local prefix list sits in front of them and turns
// three letters into a word the network can actually find.
import { Bookmark, Check, ChevronLeft, Clock, Minus, Plus, Search, Sparkles, Utensils, Wifi, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useApp } from "../constants/AppState";
import { searchFoods } from "../constants/foodApi";
import { prefixMatches } from "../constants/foodNames";
import { FOOD_DB, FoodDef, countLabel, nutritionFor } from "../constants/foods";
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
  // non-null means "using the exact count instead of a listed amount"
  const [exact, setExact] = useState<number | null>(null);

  /* what came back from the network, and whether we're still waiting */
  const [remote, setRemote] = useState<FoodDef[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  /* which word we ended up searching for — shown when it differs from what
     they typed, so an expanded prefix is never a mystery */
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  /* LOCAL FIRST. The eighteen built-in foods are matched instantly with no
     network at all, and shown while the API is still thinking. Someone typing
     "banana" sees a banana immediately rather than a spinner — and if they're
     on a train with no signal, they still get a usable answer. */
  const local = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return FOOD_DB.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.sub.toLowerCase().includes(needle)
    );
  }, [q]);

  /* WHAT THE PREFIX LIST THINKS THEY MEANT. "broc" → ["broccoli"].
     Offered as taps rather than applied silently: guessing wrong and
     searching for it anyway would be worse than the original problem, and
     "cau" could reasonably mean cauliflower or cauliflower rice. */
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    /* nothing to suggest if they've already typed a full name */
    const hits = prefixMatches(needle, 6);
    return hits.filter((h) => h !== needle);
  }, [q]);

  /* the two lists joined, local on top, no duplicates */
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
      /* nothing from EITHER source usually means the request failed rather
         than that the food doesn't exist — worth distinguishing, because the
         two need different advice */
      setFailed(results.length === 0);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [q]);

  const reset = () => { setFood(null); setIdx(0); setExact(null); };
  const close = () => { reset(); setQ(""); setRemote([]); setSearchedFor(null); onClose(); };

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
    setRemote([]);
    setSearchedFor(null);
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
            {searching && <ActivityIndicator size="small" color={T.green} />}
            {q.length > 0 && !searching && (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <X size={16} color={T.micro} />
              </Pressable>
            )}
          </View>

          {/* DID YOU MEAN. Offered rather than applied — "cau" could be
              cauliflower or cauliflower rice, and picking for them would be
              worse than the strict matching this exists to soften. */}
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

              {/* the food database matches whole words, and saying so up front
                  costs nothing. The prefix list covers the common cases; this
                  covers everything it doesn't. */}
              <View style={s.tipCard}>
                <Text style={s.tipTitle}>Searching works best with full words</Text>
                <Text style={s.tipBody}>
                  The food database matches whole words, so "broc" finds nothing on its own —
                  type "broccoli". Common foods will suggest themselves as you type.
                  {"\n\n"}
                  Simpler is better too: "rice" beats "basmati rice pilaf".
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

              {/* if we quietly searched for a different word, say so — results
                  that don't match what was typed are otherwise confusing */}
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

              {/* still waiting, and nothing local matched */}
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
                      Nothing matches "{q}". Try the food's full name — the database matches
                      whole words, so "broc" finds nothing while "broccoli" does.
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

    tipCard: {
      marginTop: 22, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15,
    },
    tipTitle: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 7 },
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
    empty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18, paddingHorizontal: 10 },

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