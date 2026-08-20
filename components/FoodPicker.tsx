// components/FoodPicker.tsx
// Search a food, say how much, get an item back.
//
// FULL SCREEN, deliberately. A centred card fought the keyboard: the card rose,
// the keyboard covered the list, and the search field ended up half-hidden.
//
// SEARCHING WORKS DIFFERENTLY FOR THE TWO SOURCES, and the screen says so
// because the right advice is genuinely opposite in each case:
//
//   PACKAGED PRODUCTS (Open Food Facts) are listed under the name on the front
//   of the bottle. "Honey sriracha sauce" finds nothing; "honey sriracha Lee
//   Kum Kee" finds it immediately. MORE words, including the brand.
//
//   PLAIN INGREDIENTS (USDA) are listed as ingredients, not as dishes. "Rice"
//   is there; "basmati rice pilaf" isn't. FEWER words.
//
// AND WHEN NEITHER HAS IT, that's not a dead end any more. A bag of large
// green lentils has a name on the front and a nutrition panel on the back —
// the user is holding the answer, and AddFoodFlow is how they hand it over.
import { BadgeCheck, Camera, Check, ChevronLeft, Clock, Info, Minus, Plus, Search, SearchX, Sparkles, Trash2, Utensils, WifiOff, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useApp } from "../constants/AppState";
import { CustomFood, customToFoodDef, deleteCustomFood, listCustomFoods, searchCustomFoods } from "../constants/customFoods";
import { searchFoodsChecked } from "../constants/foodApi";
import { prefixMatches } from "../constants/foodNames";
import { FOOD_DB, FoodDef, nutritionFor, rungDetail, rungLabel } from "../constants/foods";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import AddFoodFlow from "./AddFoodFlow";
import Tap from "./Tap";

const RECENT = ["Greek yogurt", "Banana", "Black coffee"];

const DEBOUNCE_MS = 350;

export type PickedFood = {
  name: string;
  key: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  grams: number;
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
  const { T, userId } = useApp();
  const s = styles(T);

  const [q, setQ] = useState("");
  const [food, setFood] = useState<FoodDef | null>(null);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(1);

  const [remote, setRemote] = useState<FoodDef[]>([]);
  const [mine, setMine] = useState<FoodDef[]>([]);
  const [saved, setSaved] = useState<CustomFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  /* adding a food nothing has heard of */
  const [adding, setAdding] = useState(false);

  /* ---------- the user's own foods ----------
     Loaded once when the picker opens, so they're there instantly. These are
     foods somebody stood in their kitchen and photographed; they've earned
     top billing over anything a database returns. */
  const loadSaved = useCallback(async () => {
    if (!userId) return;
    const list = await listCustomFoods(userId);
    setSaved(list);
  }, [userId]);

  useEffect(() => {
    if (visible) loadSaved();
  }, [visible, loadSaved]);

  const local = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return FOOD_DB.filter(
      (f) => f.name.toLowerCase().includes(needle) || f.sub.toLowerCase().includes(needle)
    );
  }, [q]);

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return prefixMatches(needle, 6).filter((h) => h !== needle);
  }, [q]);

  /* THE USER'S OWN FIRST. They photographed this packet themselves; it beats
     anything a volunteer typed into a database on the other side of the
     world. */
  const list = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodDef[] = [];
    [...mine, ...local, ...remote].forEach((f) => {
      const k = f.name.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(f);
    });
    return out;
  }, [mine, local, remote]);

  /* ---------- the debounced search ---------- */
  const timer = useRef<any>(null);
  const reqId = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const needle = q.trim();

    if (needle.length < 2) {
      setRemote([]);
      setMine([]);
      setSearching(false);
      setOffline(false);
      setSearchedFor(null);
      return;
    }

    setSearching(true);
    setOffline(false);

    timer.current = setTimeout(async () => {
      const my = ++reqId.current;

      /* the user's own foods come back first and locally — no reason to wait
         on USDA to show someone their own lentils */
      if (userId) {
        const own = await searchCustomFoods(userId, needle);
        if (my === reqId.current) setMine(own.map(customToFoodDef));
      }

      let { foods, online } = await searchFoodsChecked(needle);
      let usedTerm: string | null = null;

      if (foods.length === 0 && online) {
        const guess = prefixMatches(needle, 1)[0];
        if (guess && guess !== needle.toLowerCase()) {
          const second = await searchFoodsChecked(guess);
          if (my !== reqId.current) return;
          if (second.foods.length) {
            foods = second.foods;
            usedTerm = guess;
          }
        }
      }

      if (my !== reqId.current) return;

      setRemote(foods);
      setSearchedFor(usedTerm);
      setSearching(false);
      setOffline(!online);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [q, userId]);

  const reset = () => { setFood(null); setIdx(0); setCount(1); };
  const close = () => { reset(); setQ(""); setRemote([]); setMine([]); setSearchedFor(null); onClose(); };

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
      cal: n.cal, p: n.p, c: n.c, f: n.f,
      grams,
      amountLabel: label,
    });
    reset();
    setQ("");
    setRemote([]);
    setMine([]);
  };

  const removeSaved = async (id: string) => {
    if (!userId) return;
    H.warn();
    await deleteCustomFood(userId, id);
    loadSaved();
  };

  const FoodRow = ({ f, own }: { f: FoodDef; own?: boolean }) => {
    const d = f.amounts[f.defaultIndex] || f.amounts[0];
    return (
      <Tap onPress={() => openFood(f)}>
        <View style={s.row}>
          <View style={[s.rowIcon, own && s.rowIconOwn]}>
            {own ? <BadgeCheck size={15} color={T.gold} /> : <Utensils size={15} color={T.micro} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowName} numberOfLines={1}>{f.name}</Text>
            <Text style={s.rowSub} numberOfLines={1}>
              {nutritionFor(f, d.grams).cal} cal for {d.label.toLowerCase()}
              {own ? " · yours" : f.sub && f.sub !== "generic" ? ` · ${f.sub}` : ""}
            </Text>
          </View>
        </View>
      </Tap>
    );
  };

  /* ---------- adding a food ---------- */
  if (adding) {
    return (
      <AddFoodFlow
        visible
        meal={title || "meal"}
        initialName={q.trim() || null}
        onClose={() => { setAdding(false); loadSaved(); }}
        onDone={({ food: f }) => {
          setAdding(false);
          loadSaved();
          openFood(f);
        }}
      />
    );
  }

  /* ---------- how much? ---------- */
  if (food) {
    const rung = food.amounts[idx];
    const countable = !!rung?.unit;
    const grams = (rung?.grams ?? 0) * count;
    const label = countable && count > 1 ? rungLabel(rung, count) : rung?.label ?? "";
    const n = nutritionFor(food, grams);
    const hasExact = food.amounts.some((a) => a.exact);

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
              {hasExact
                ? "The gold one is straight off the label — the rest are estimates you can picture."
                : "Each option says what it looks like. Tap one, then use + and − for more than one."}
            </Text>

            <View style={{ gap: 9, marginTop: 20 }}>
              {food.amounts.map((a, i) => {
                const on = i === idx;
                const rowCal = nutritionFor(food, a.grams).cal;
                const canCount = !!a.unit;
                const gold = !!a.exact;

                return (
                  <View key={`${a.label}-${i}`} style={{ gap: 8 }}>
                    <Tap onPress={() => { H.tick(); setIdx(i); setCount(1); }}>
                      <View style={[s.option, gold && s.optionGold, on && (gold ? s.optionGoldOn : s.optionOn)]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          {gold && (
                            <View style={s.exactTag}>
                              <BadgeCheck size={11} color={T.gold} />
                              <Text style={s.exactTagText}>EXACTLY AS THE PACK STATES IT</Text>
                            </View>
                          )}
                          <Text style={[s.optionLabel, on && { color: gold ? T.gold : T.green }]}>{a.label}</Text>
                          {a.hint ? <Text style={s.optionHint}>{a.hint}</Text> : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.optionCal, on && { color: gold ? T.gold : T.green }]}>{rowCal}</Text>
                          <Text style={s.optionCalUnit}>cal</Text>
                        </View>
                        {on && <Check size={17} color={gold ? T.gold : T.green} style={{ marginLeft: 8 }} />}
                      </View>
                    </Tap>

                    {on && canCount && (
                      <View style={[s.counter, gold && s.counterGold]}>
                        <Pressable
                          onPress={() => { H.tick(); setCount((c) => Math.max(1, c - 1)); }}
                          style={[s.counterBtn, count <= 1 && { opacity: 0.35 }]}
                          hitSlop={8}
                          disabled={count <= 1}
                        >
                          <Minus size={18} color={T.text} />
                        </Pressable>

                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text style={[s.counterNum, gold && { color: T.gold }]}>{rungLabel(a, count)}</Text>
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
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
              {/* THE USER'S OWN FOODS, real ones now. This section used to show
                  two hardcoded placeholder names. */}
              {saved.length > 0 && (
                <>
                  <View style={s.sectionRow}>
                    <BadgeCheck size={12} color={T.gold} />
                    <Text style={s.micro}>Foods you added</Text>
                  </View>
                  <View style={s.group}>
                    {saved.map((c, i) => (
                      <View key={c.id}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={s.savedRow}>
                          <View style={{ flex: 1 }}>
                            <FoodRow f={customToFoodDef(c)} own />
                          </View>
                          <Pressable onPress={() => removeSaved(c.id)} hitSlop={10} style={s.deleteBtn}>
                            <Trash2 size={14} color={T.micro} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={[s.sectionRow, saved.length > 0 && { marginTop: 18 }]}>
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

              {/* ADD ONE YOURSELF, available without failing a search first —
                  someone who already knows their food isn't listed shouldn't
                  have to prove it again */}
              <Tap onPress={() => { H.tap(); setAdding(true); }} style={{ marginTop: 18 }}>
                <View style={s.addOwnCard}>
                  <View style={s.addOwnIcon}>
                    <Camera size={17} color={T.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addOwnTitle}>Add a food yourself</Text>
                    <Text style={s.addOwnBody}>
                      Two photos — the front of the packet and the nutrition panel — and MOTION
                      reads the rest. No typing.
                    </Text>
                  </View>
                </View>
              </Tap>

              <View style={s.tipCard}>
                <View style={s.tipHead}>
                  <Info size={14} color={T.green} />
                  <Text style={s.tipTitle}>Finding what you ate</Text>
                </View>

                <Text style={s.tipBody}>
                  Whole words only. "broc" finds nothing on its own — "broccoli" finds it. Common
                  foods suggest themselves as you type; anything else needs spelling out.
                </Text>

                <View style={s.tipDivider} />

                <Text style={s.tipSubhead}>For a packaged product</Text>
                <Text style={s.tipBody}>
                  Add the brand. "Honey sriracha sauce" often finds nothing, while "honey sriracha
                  Lee Kum Kee" finds it straight away — packaged foods are listed under the name
                  printed on the front of the bottle.
                </Text>

                <View style={s.tipDivider} />

                <Text style={s.tipSubhead}>For a plain ingredient</Text>
                <Text style={s.tipBody}>
                  Keep it simple. "Rice" is listed; "basmati rice pilaf" probably isn't, because
                  the database holds ingredients rather than every dish made from them.
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
                      <FoodRow f={f} own={f.sub === "your own"} />
                    </View>
                  ))}
                </View>
              )}

              {searching && list.length === 0 && (
                <View style={s.searchingBox}>
                  <ActivityIndicator size="small" color={T.green} />
                  <Text style={s.searchingText}>Looking through the food database…</Text>
                </View>
              )}

              {/* NOTHING CAME BACK. Which of these shows depends on whether the
                  request actually reached anyone. */}
              {!searching && list.length === 0 && (
                offline ? (
                  <View style={s.emptyBox}>
                    <View style={s.emptyIcon}>
                      <WifiOff size={26} color={T.sub} />
                    </View>
                    <Text style={s.emptyTitle}>Couldn't reach the food database</Text>
                    <Text style={s.empty}>
                      The search needs a connection, and this one didn't get through. Check your
                      wifi or mobile data and try again.
                    </Text>
                  </View>
                ) : (
                  <View style={s.emptyBox}>
                    <View style={s.emptyIcon}>
                      <SearchX size={26} color={T.sub} />
                    </View>

                    <Text style={s.emptyTitle}>Nothing matches "{q}" yet</Text>

                    {/* THE WAY OUT, first and prominent. A failed search used
                        to be a dead end — the user gave up on logging
                        something they were holding in their hand. */}
                    <Tap onPress={() => { H.tap(); setAdding(true); }} style={{ width: "100%", marginTop: 4 }}>
                      <View style={s.rescueCard}>
                        <View style={s.addOwnIcon}>
                          <Camera size={17} color={T.gold} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rescueTitle}>Add it yourself instead</Text>
                          <Text style={s.rescueBody}>
                            Some products are too small or too local to be in any database. Two
                            photos — the front of the packet and the nutrition panel — and MOTION
                            reads the rest. Save it once and it's there for good.
                          </Text>
                        </View>
                      </View>
                    </Tap>

                    <Text style={s.emptyOr}>or try the search again</Text>

                    <View style={s.emptyCard}>
                      <Text style={s.emptyHead}>If it came in a packet, add the brand</Text>
                      <Text style={s.emptyBody}>
                        Packaged foods are listed under the name on the front of the bottle, brand
                        included — so "honey sriracha Lee Kum Kee" finds what "honey sriracha
                        sauce" misses entirely.
                      </Text>
                    </View>

                    <View style={s.emptyCard}>
                      <Text style={s.emptyHead}>If it's a plain ingredient, use fewer words</Text>
                      <Text style={s.emptyBody}>
                        "Rice" is listed; "basmati rice pilaf" isn't, because the database holds
                        ingredients rather than every dish made from them.
                      </Text>
                    </View>
                  </View>
                )
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

    /* add your own */
    addOwnCard: {
      flexDirection: "row", alignItems: "center", gap: 13,
      backgroundColor: "rgba(251,191,36,0.07)",
      borderWidth: 1, borderColor: `${T.gold}55`,
      borderRadius: 15, padding: 15,
    },
    addOwnIcon: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}44`,
      alignItems: "center", justifyContent: "center",
    },
    addOwnTitle: { fontSize: 13.5, color: T.gold, fontFamily: FONTS.headingMed },
    addOwnBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 16.5 },

    rescueCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 13,
      backgroundColor: "rgba(251,191,36,0.10)",
      borderWidth: 1, borderColor: `${T.gold}77`,
      borderRadius: 16, padding: 16,
    },
    rescueTitle: { fontSize: 14.5, color: T.gold, fontFamily: FONTS.headingMed },
    rescueBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 17.5 },
    emptyOr: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 6, marginBottom: 2 },

    tipCard: {
      marginTop: 18, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15,
    },
    tipHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
    tipTitle: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    tipSubhead: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed, marginBottom: 5 },
    tipBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },
    tipDivider: { height: 1, backgroundColor: T.border, marginVertical: 12 },

    sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9, marginLeft: 2 },
    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 56 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 13 },
    rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
    rowIconOwn: { backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: `${T.gold}44` },
    rowName: { flex: 1, fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    rowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    savedRow: { flexDirection: "row", alignItems: "center" },
    deleteBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginRight: 4 },

    searchingBox: { alignItems: "center", gap: 12, paddingVertical: 34 },
    searchingText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    emptyBox: { alignItems: "center", paddingTop: 20, paddingBottom: 10, gap: 12 },
    emptyIcon: {
      width: 58, height: 58, borderRadius: 19,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center", marginBottom: 2,
    },
    emptyTitle: { fontSize: 16.5, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    empty: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18.5, paddingHorizontal: 4 },
    emptyCard: {
      width: "100%", backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15, marginTop: 2,
    },
    emptyHead: { fontSize: 12.5, color: T.green, fontFamily: FONTS.headingMed, marginBottom: 6 },
    emptyBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    /* how much */
    question: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    questionSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 18 },

    option: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingVertical: 14, paddingHorizontal: 15,
    },
    optionOn: { borderColor: T.green, backgroundColor: T.greenBg },
    optionGold: { borderColor: `${T.gold}66`, backgroundColor: "rgba(251,191,36,0.07)" },
    optionGoldOn: { borderColor: T.gold, backgroundColor: "rgba(251,191,36,0.14)" },
    exactTag: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
    exactTagText: { fontSize: 8.5, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    optionLabel: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    optionHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3, lineHeight: 15.5 },
    optionCal: { fontSize: 15, color: T.sub, fontFamily: FONTS.heading },
    optionCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    counter: {
      flexDirection: "row", alignItems: "center", marginLeft: 14,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    },
    counterGold: { borderColor: `${T.gold}55` },
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