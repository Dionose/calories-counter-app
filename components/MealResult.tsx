// components/MealResult.tsx
// What a meal photo produced, and how to fix it.
//
// THIS SCREEN'S WHOLE JOB IS HONEST UNCERTAINTY. A nutrition panel gives
// printed numbers; a plate of food gives none. The model identified what it
// could see and guessed at volumes it can't — the honest accuracy is around
// ±25%, and nothing in this file changes that.
//
// So instead of hiding the estimate behind confident-looking numbers, the
// screen does three things:
//
//   1. SAYS IT'S AN ESTIMATE, plainly, in the header. Not buried in a
//      disclaimer nobody reads.
//   2. MARKS THE SHAKY ITEMS. The model reports its own confidence per item,
//      and a splash of oil genuinely is less knowable than a whole apple.
//      Pointing at the uncertain ones tells the user where their attention is
//      worth spending.
//   3. MAKES EVERY ITEM CORRECTABLE. Tap it, change the amount, or remove it
//      entirely — because separate items exist precisely so a wrong one can be
//      fixed without rejecting the whole plate.
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, Camera, Check, ChevronRight, CircleHelp, Plus, Sparkles, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { colorFor } from "../constants/foodColors";
import { Amount } from "../constants/foods";
import * as H from "../constants/haptics";
import { MealItem, mealTotals } from "../constants/mealPhoto";
import { saveMeal, setMealPhoto } from "../constants/meals";
import { uploadMealPhoto } from "../constants/photos";
import { FONTS } from "../constants/theme";
import AmountSheet from "./AmountSheet";
import FoodPicker, { PickedFood } from "./FoodPicker";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

/* how the model's own confidence reads to a person.

   The wording matters. "Low confidence" sounds like a failure; "hard to judge"
   is the truth and doesn't imply anyone did anything wrong. Some things are
   genuinely unknowable from a photograph. */
const SHAKY = {
  label: "HARD TO JUDGE",
  note: "Hidden volume — worth a look if you know better than the photo does.",
};

export default function MealResult({
  meal, photoUri, items: initialItems, summary, onExit, onRetake,
}: {
  meal: string;
  photoUri?: string | null;
  items: MealItem[];
  summary?: string | null;
  onExit: () => void;
  onRetake: () => void;
}) {
  const { T, userId, refreshStreak } = useApp();
  const s = styles(T);

  const [items, setItems] = useState<MealItem[]>(initialItems);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totals = mealTotals(items);

  /* the count animating up, so the number arrives rather than appearing */
  const count = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    count.stopAnimation();
    Animated.timing(count, {
      toValue: totals.cal,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    return () => count.removeListener(id);
  }, [totals.cal]);

  /* ---------- correcting an item ----------
     The ladder here is generic, because a photo estimate has no label to
     anchor to — but it's still relative to what the model saw, which is
     honest, rather than "a normal serving", which would be the abstract
     phrasing the whole amount system exists to remove. */
  const ladderFor = (item: MealItem): Amount[] => {
    const g = item.grams || 100;
    return [
      { label: "Half of that", hint: `about ${Math.round(g / 2)} g`, grams: Math.round(g / 2) },
      { label: item.amountLabel, hint: `what MOTION estimated · about ${g} g`, grams: g, unit: "portion", unitPlural: "portions" },
      { label: "Half again as much", hint: `about ${Math.round(g * 1.5)} g`, grams: Math.round(g * 1.5) },
      { label: "Twice that", hint: `about ${Math.round(g * 2)} g`, grams: Math.round(g * 2) },
    ];
  };

  const applyEdit = (i: number, grams: number, label: string) => {
    setItems((list) =>
      list.map((it, n) => {
        if (n !== i) return it;
        /* scale the macros with the weight — the per-gram figures were the
           model's, and changing how much doesn't change what it is */
        const factor = grams / (it.grams || 1);
        return {
          ...it,
          grams: Math.round(grams),
          amountLabel: label,
          calories: Math.round(it.calories * factor),
          protein: Math.round(it.protein * factor),
          carbs: Math.round(it.carbs * factor),
          fat: Math.round(it.fat * factor),
          /* a corrected item is no longer a guess */
          sure: "high",
        };
      })
    );
  };

  const removeItem = (i: number) => {
    H.warn();
    setItems((list) => list.filter((_, n) => n !== i));
  };

  const addPicked = (f: PickedFood) => {
    setAdding(false);
    H.success();
    setItems((list) => [
      ...list,
      {
        name: f.name,
        amountLabel: f.amountLabel,
        grams: f.grams,
        calories: f.cal,
        protein: f.p,
        carbs: f.c,
        fat: f.f,
        /* the user chose this one themselves — nothing estimated about it */
        sure: "high",
      },
    ]);
  };

  /* ---------- the write ---------- */
  const logIt = async () => {
    if (saving || !items.length) return;
    if (!userId) { setSaveErr("You're signed out — sign in and try again."); return; }

    setSaveErr(null);
    setSaving(true);

    const { mealId, error } = await saveMeal(userId, {
      mealType: meal.toLowerCase() as any,
      source: "photo",
      items: items.map((i) => ({
        foodName: i.name,
        amountLabel: i.amountLabel,
        grams: i.grams,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        /* an item the user corrected is no longer the AI's guess — worth
           keeping apart, so we can later measure how often the estimate
           needed fixing and by how much */
        source: i.sure === "high" ? "user" : "ai",
      })),
    });

    setSaving(false);

    if (error || !mealId) {
      /* stay on the plate. Bouncing to the success screen after a failed save
         would tell them it worked when it didn't, and they'd lose every
         correction they just made. */
      setSaveErr(error || "Couldn't save that meal.");
      H.warn();
      return;
    }

    /* THE MEAL IS ALREADY SAVED. The photo goes up afterwards and is NOT
       awaited — a slow or failed upload must not cost the user their meal.
       Worst case they get a recap card with no picture, which is a far
       smaller loss than a save that appeared to fail.

       The upload needs the meal's id for its filename, which is why it can't
       happen any earlier. Forgetting this call entirely is exactly what left
       photo-logged meals showing up on the calendar with no image at all,
       while barcode meals looked fine — the bug was invisible until someone
       went back and looked at a previous day. */
    if (photoUri) {
      uploadMealPhoto(userId, mealId, photoUri)
        .then(({ path }) => { if (path) setMealPhoto(mealId, path); })
        .catch(() => {});
    }

    /* today's first meal may have just extended the streak — recompute so the
       flame and tier are right by the time they're back on Home */
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
        <Text style={s.doneSub}>
          {items.length} {items.length === 1 ? "item" : "items"} · {totals.cal} cal
        </Text>

        <Tap onPress={onRetake} style={{ marginTop: 18, width: "100%", maxWidth: 260 }}>
          <View style={s.doneGhost}>
            <Text style={s.doneGhostText}>Log something else</Text>
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

  const anyShaky = items.some((i) => i.sure === "low");

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

        {/* AN ESTIMATE, said plainly and at the top. The barcode path earns
            "EXACT · FROM THE LABEL"; this one hasn't, and pretending otherwise
            would be the single most damaging thing this screen could do. */}
        <View style={s.estimateRow}>
          <Sparkles size={14} color={T.green} />
          <Text style={s.estimateText}>MOTION'S ESTIMATE</Text>
        </View>

        <Text style={s.summary}>{summary || "Your meal"}</Text>

        {/* the photo, small — enough to confirm we read the right plate */}
        {photoUri ? (
          <View style={s.photoWrap}>
            <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" />
          </View>
        ) : null}

        {/* the total */}
        <View style={{ marginTop: 16 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 18 }}>
              <Text style={s.micro}>About</Text>
              <View style={s.totalRow}>
                <Text style={s.totalCal}>{shown.toLocaleString()}</Text>
                <Text style={s.totalUnit}>calories</Text>
              </View>

              <View style={s.macroRow}>
                {[["Protein", totals.p], ["Carbs", totals.c], ["Fat", totals.f]].map(([k, v]: any) => (
                  <View key={k} style={s.macroTile}>
                    <Text style={s.macroNum}>{v}g</Text>
                    <Text style={s.macroKey}>{k}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TravelBorder>
        </View>

        {/* WHY THE ITEMS ARE SEPARATE, said once. A user who understands this
            will correct the one wrong item instead of retaking the photo. */}
        <View style={s.explainRow}>
          <CircleHelp size={13} color={T.micro} />
          <Text style={s.explainText}>
            Tap anything that looks off — MOTION can't see how much is under the sauce.
          </Text>
        </View>

        <Text style={[s.micro, { marginTop: 18, marginBottom: 10 }]}>
          {items.length} {items.length === 1 ? "item" : "items"}
        </Text>

        <View style={{ gap: 9 }}>
          {items.map((item, i) => {
            const shaky = item.sure === "low";
            const col = colorFor(guessColorKey(item.name));

            return (
              <Tap key={`${item.name}-${i}`} onPress={() => { H.tap(); setEditing(i); }}>
                <View style={[s.item, shaky && s.itemShaky]}>
                  {/* a thin colour bar, so the list reads as food rather than
                      a spreadsheet */}
                  <LinearGradient
                    colors={[col.from, col.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.itemStripe}
                  />

                  <View style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
                    {shaky ? (
                      <View style={s.shakyTag}>
                        <AlertTriangle size={9} color={T.gold} />
                        <Text style={s.shakyTagText}>{SHAKY.label}</Text>
                      </View>
                    ) : null}

                    <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={s.itemAmount}>
                      {item.amountLabel} · about {item.grams} g
                    </Text>

                    {shaky ? <Text style={s.shakyNote}>{SHAKY.note}</Text> : null}
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.itemCal}>{item.calories}</Text>
                    <Text style={s.itemCalUnit}>cal</Text>
                  </View>

                  <ChevronRight size={17} color={T.micro} style={{ marginLeft: 8 }} />
                </View>
              </Tap>
            );
          })}
        </View>

        {/* MISSING SOMETHING. The model lists what it can see, and a photo
            taken from above misses the glass of juice beside the plate. */}
        <Tap onPress={() => { H.tap(); setAdding(true); }} style={{ marginTop: 12 }}>
          <View style={s.addRow}>
            <Plus size={16} color={T.green} />
            <Text style={s.addText}>Add something MOTION missed</Text>
          </View>
        </Tap>

        {anyShaky ? (
          <Text style={s.shakyFoot}>
            The marked items are the ones with hidden volume — oil, sauce, anything under
            something else. Those are where an estimate drifts furthest, and where you know more
            than the photo does.
          </Text>
        ) : null}

        {saveErr ? (
          <View style={s.errRow}>
            <AlertTriangle size={14} color={T.red} />
            <Text style={s.errText}>{saveErr}</Text>
          </View>
        ) : null}

        <Tap onPress={logIt} style={{ marginTop: 18 }}>
          <View style={[s.logBtn, (saving || !items.length) && { opacity: 0.55 }]}>
            <Text style={s.logBtnText}>
              {saving ? "Logging…" : `Log to ${meal} · ${totals.cal} cal`}
            </Text>
          </View>
        </Tap>

        <Tap onPress={onRetake} style={{ marginTop: 10 }}>
          <View style={s.retakeBtn}>
            <Camera size={15} color={T.sub} />
            <Text style={s.retakeText}>Take a different photo</Text>
          </View>
        </Tap>
      </ScrollView>

      {/* correcting one item */}
      {editing != null && items[editing] && (
        <AmountSheet
          visible
          name={items[editing].name}
          currentGrams={items[editing].grams}
          currentLabel={items[editing].amountLabel}
          perGram={{
            cal: items[editing].calories / (items[editing].grams || 1),
            p: items[editing].protein / (items[editing].grams || 1),
            c: items[editing].carbs / (items[editing].grams || 1),
            f: items[editing].fat / (items[editing].grams || 1),
          }}
          amounts={ladderFor(items[editing])}
          onClose={() => setEditing(null)}
          onChange={(r) => {
            applyEdit(editing, r.grams, r.amountLabel);
            setEditing(null);
          }}
          onRemove={() => {
            removeItem(editing);
            setEditing(null);
          }}
        />
      )}

      {/* adding what the photo missed */}
      <FoodPicker
        visible={adding}
        title="Add to this meal"
        onClose={() => setAdding(false)}
        onPick={addPicked}
      />
    </View>
  );
}

/* rough colour matching for the stripe. Nothing depends on it being right —
   it's decoration that makes a list of foods look like food. */
function guessColorKey(name: string): string {
  const n = name.toLowerCase();
  if (/egg/.test(n)) return "eggs";
  if (/yogurt|yoghurt/.test(n)) return "yogurt";
  if (/avocado/.test(n)) return "avocado";
  if (/tomato/.test(n)) return "tomato";
  if (/rice/.test(n)) return "rice";
  if (/chicken|turkey|beef|pork|steak|lamb|bacon/.test(n)) return "chicken";
  if (/salmon|tuna|fish|prawn|shrimp/.test(n)) return "fish";
  if (/bread|toast|bagel/.test(n)) return "bread";
  if (/banana/.test(n)) return "banana";
  if (/nut|almond|cashew|peanut/.test(n)) return "nuts";
  if (/oil|butter|dressing|sauce/.test(n)) return "oil";
  if (/coffee/.test(n)) return "coffee";
  if (/juice|smoothie/.test(n)) return "juice";
  if (/pasta|noodle|spaghetti/.test(n)) return "pasta";
  if (/bean|lentil/.test(n)) return "greens";
  return "greens";
}

const styles = (T: any) =>
  StyleSheet.create({
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },

    estimateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    estimateText: { fontSize: 10, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.body },
    summary: { fontSize: 23, color: T.text, fontFamily: FONTS.heading, lineHeight: 29 },

    photoWrap: {
      marginTop: 14, borderRadius: 16, overflow: "hidden",
      borderWidth: 1, borderColor: T.border,
    },
    photo: { width: "100%", height: 150 },

    totalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 },
    totalCal: { fontSize: 42, color: T.green, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

    macroRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    macroNum: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    macroKey: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

    explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 16, paddingHorizontal: 2 },
    explainText: { flex: 1, fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 16.5 },

    item: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingVertical: 13, paddingRight: 15,
      overflow: "hidden",
    },
    itemShaky: { borderColor: `${T.gold}44` },
    itemStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },

    shakyTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    shakyTagText: { fontSize: 8, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    itemName: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    itemAmount: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    shakyNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 5, lineHeight: 15 },

    itemCal: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    itemCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    addRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderStyle: "dashed",
      borderRadius: 14, paddingVertical: 14,
    },
    addText: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },

    shakyFoot: {
      fontSize: 11, color: T.micro, fontFamily: FONTS.body,
      lineHeight: 16.5, marginTop: 14, paddingHorizontal: 4,
    },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    logBtn: { backgroundColor: T.green, borderRadius: 15, paddingVertical: 16, alignItems: "center" },
    logBtnText: { fontSize: 15, color: T.ink, fontFamily: FONTS.headingMed },

    retakeBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14,
    },
    retakeText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },

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