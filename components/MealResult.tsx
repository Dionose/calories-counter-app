// components/MealResult.tsx
// What a meal estimate produced, and how to improve it.
//
// THIS SCREEN'S WHOLE JOB IS HONEST UNCERTAINTY. A nutrition panel gives
// printed numbers; a plate of food gives none. The honest accuracy is around
// ±25%, and nothing in this file changes that. So it says it's an estimate,
// marks the shaky items, makes everything correctable, and lets the person
// describe the dish out loud.
//
// A DISH CAN HOLD ITS INGREDIENTS. Describe a stew and what went into it and
// the stew stays ONE row — it's one thing you eat — but it carries its
// ingredients, each with its own calories, and the row is worth what they add
// up to. Counting the oil actually moves the day's total.
//
// TAP EDITS, HOLD REVEALS. Tapping any row opens the amount sheet, dish or
// not, so that gesture never changes meaning. HOLDING a dish opens what went
// into it. The row SAYS "hold to see" — a hidden gesture is only fair when
// it's advertised.
//
// THE DISH ROW IS GOLD AND IT TRAVELS. Gold elsewhere means label-exact
// manufacturer data, and this isn't that — Dion's call, made deliberately: the
// barcode scanner and a home-cooked stew never share a screen, and a fifth
// colour costs more in consistency than the overlap costs in meaning.
//
// SET ASIDE, NOT DELETED. When a description replaces the plate, what the
// photo guessed and the person didn't mention drops below with its calories
// shown but NOT counted. The photo saw something; maybe they forgot. Nothing
// nags — log without touching it and it isn't logged.
//
// THE VOICE SHEET OPENS IN "improve" MODE from here, not "describe". There's
// already a plate on screen, so asking "say what you ate" would be asking them
// to repeat what MOTION just told them. What's actually missing is what the
// photo COULDN'T see — the oil, the butter, what the dish really is.
//
// A HAND CORRECTION OUTRANKS A SPOKEN ONE.
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, Camera, Check, ChevronRight, CircleHelp, EyeOff, Mic, Plus, Sparkles, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { addIngredients } from "../constants/addIngredient";
import { useApp } from "../constants/AppState";
import { colorFor } from "../constants/foodColors";
import { Amount } from "../constants/foods";
import * as H from "../constants/haptics";
import { fixMealWithVoice } from "../constants/mealFix";
import { MealItem, mealTotals } from "../constants/mealPhoto";
import { MealPart, partsTotal, saveMeal, setMealPhoto } from "../constants/meals";
import { uploadMealPhoto } from "../constants/photos";
import { FONTS } from "../constants/theme";
import AmountSheet from "./AmountSheet";
import FoodPicker, { PickedFood } from "./FoodPicker";
import Icon from "./Icon";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";
import VoiceCapture from "./VoiceCapture";

const SHAKY = {
  label: "HARD TO JUDGE",
  note: "Hidden volume — worth a look if you know better than the photo does.",
};

/* a row is an item plus the bookkeeping this screen needs.

   `manual`     — the user set this themselves. Voice never touches it.
   `justChanged`— lit by the last spoken description.
   `setAside`   — the photo saw it, the description didn't mention it.
   `parts`      — the ingredients of a cooked dish.
   `uid`        — everything is keyed by this rather than by position, because
                  adding and setting aside shuffles the indexes underneath. */
type Row = MealItem & {
  uid: number;
  manual?: boolean;
  justChanged?: boolean;
  setAside?: boolean;
  parts?: MealPart[];
};

let nextUid = 1;
const toRow = (item: MealItem & { parts?: MealPart[] }, manual = false): Row => ({
  ...item,
  uid: nextUid++,
  manual,
});

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

  const [items, setItems] = useState<Row[]>(() => initialItems.map((i) => toRow(i)));
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  /* which row's ingredients are on screen, by uid. EVERY row can open this
     now, not just dishes — see holdRow. */
  const [showing, setShowing] = useState<number | null>(null);

  /* ---------- ADDING ONE FORGOTTEN INGREDIENT ----------
     Separate from the whole-plate voice below. `addingTo` is the uid of the
     row being added to; the rest is that one call's state.

     WHY THIS EXISTS. Dion described a meal at length and one item — a scotch
     bonnet — didn't survive into the result. Re-describing an entire plate to
     add one pepper is absurd, and forgetting something is the ordinary case
     rather than the edge case. */
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [partBusy, setPartBusy] = useState(false);
  const [partNote, setPartNote] = useState<string | null>(null);
  const [partErr, setPartErr] = useState<string | null>(null);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixNote, setFixNote] = useState<string | null>(null);
  const [fixProblem, setFixProblem] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /* WHAT COUNTS. Set-aside items are on screen but out of every number on it. */
  const counted = items.filter((r) => !r.setAside);
  const aside = items.filter((r) => r.setAside);
  const totals = mealTotals(counted);

  /* WHICH voice sheet is open, if any — see the single VoiceCapture at the
     bottom of this file for why this can never be two things at once.
     `addingTo` wins if both are somehow set, because it's the more specific
     action and the one the user just asked for. */
  const voiceFor: "plate" | "part" | null =
    addingTo != null ? "part" : voiceOpen ? "plate" : null;

  const closeVoice = () => {
    setVoiceOpen(false);
    setAddingTo(null);
  };

  const editingRow = editing != null ? items.find((r) => r.uid === editing) : null;
  const showingRow = showing != null ? items.find((r) => r.uid === showing) : null;

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

  /* ---------- correcting an item ---------- */
  const ladderFor = (item: Row): Amount[] => {
    const g = item.grams || 100;
    return [
      { label: "Half of that", hint: `about ${Math.round(g / 2)} g`, grams: Math.round(g / 2) },
      { label: item.amountLabel, hint: `what MOTION estimated · about ${g} g`, grams: g, unit: "portion", unitPlural: "portions" },
      { label: "Half again as much", hint: `about ${Math.round(g * 1.5)} g`, grams: Math.round(g * 1.5) },
      { label: "Twice that", hint: `about ${Math.round(g * 2)} g`, grams: Math.round(g * 2) },
    ];
  };

  const applyEdit = (uid: number, grams: number, label: string) => {
    setItems((list) =>
      list.map((it) => {
        if (it.uid !== uid) return it;
        const factor = grams / (it.grams || 1);

        /* A DISH SCALES ITS INGREDIENTS TOO. Halving the bowl halves the oil in
           it — otherwise the row says one thing and the breakdown another. */
        const parts = it.parts
          ? it.parts.map((p) => ({
              ...p,
              grams: p.grams != null ? Math.round(p.grams * factor) : undefined,
              calories: Math.round(p.calories * factor),
              protein: p.protein != null ? Math.round(p.protein * factor) : undefined,
              carbs: p.carbs != null ? Math.round(p.carbs * factor) : undefined,
              fat: p.fat != null ? Math.round(p.fat * factor) : undefined,
            }))
          : undefined;

        return {
          ...it,
          grams: Math.round(grams),
          amountLabel: label,
          calories: Math.round(it.calories * factor),
          protein: Math.round(it.protein * factor),
          carbs: Math.round(it.carbs * factor),
          fat: Math.round(it.fat * factor),
          parts,
          sure: "high",
          manual: true,
          justChanged: false,
        };
      })
    );
  };

  const removeItem = (uid: number) => {
    H.warn();
    setItems((list) => list.filter((r) => r.uid !== uid));
  };

  const addPicked = (f: PickedFood) => {
    setAdding(false);
    H.success();
    setItems((list) => [
      ...list,
      toRow(
        {
          name: f.name,
          amountLabel: f.amountLabel,
          grams: f.grams,
          calories: f.cal,
          protein: f.p,
          carbs: f.c,
          fat: f.f,
          sure: "high",
        },
        true
      ),
    ]);
  };

  /* HOLD WORKS ON EVERY ROW, dish or not.

     It used to be dishes only, which meant a plain row of rice had no way to
     gain the butter it was fried in — and nothing on screen suggested holding
     would do anything. Now any row opens its ingredients: a dish shows what's
     already in it, a plain row shows an empty sheet and a mic. */
  const holdRow = (uid: number) => {
    H.tap();
    setPartNote(null);
    setPartErr(null);
    setShowing(uid);
  };

  /* ---------- WHAT THEY SAID WAS MISSING ----------
     ADDS ON TOP. Every ingredient already on the dish keeps exactly the
     calories it had — Dion's rule, and the right one: re-estimating the whole
     dish would be more "accurate" in theory while quietly moving figures the
     user had already read and accepted. The new thing simply joins the total.

     A PLAIN ROW BECOMES A DISH by gaining its first ingredient. That's what
     `parts` means, so the row turns gold and starts advertising its own
     breakdown — a visible signal that the words landed. */
  const onPartTranscript = async (text: string) => {
    const uid = addingTo;
    setAddingTo(null);
    if (uid == null) return;

    const row = items.find((r) => r.uid === uid);
    if (!row) return;

    setPartNote(null);
    setPartErr(null);
    setPartBusy(true);

    const { parts: added, note, error } = await addIngredients(row.name, text);

    setPartBusy(false);

    /* BACK TO THE SHEET EITHER WAY. They opened it, spoke into it, and the
       answer belongs there — dropping them on the plate with a changed number
       and no explanation would be the same failure as a silent save. */
    const reopen = () => setTimeout(() => setShowing(uid), 260);

    if (error) { setPartErr(error); H.warn(); reopen(); return; }

    if (!added.length) {
      /* the model understood the request and found nothing to add — its own
         wording is more useful here than a generic failure */
      setPartErr(note || "MOTION couldn't tell what to add from that.");
      H.warn();
      reopen();
      return;
    }

    const gained = added.reduce(
      (t, p) => ({
        cal: t.cal + p.calories,
        pr: t.pr + p.protein,
        cb: t.cb + p.carbs,
        ft: t.ft + p.fat,
        g: t.g + p.grams,
      }),
      { cal: 0, pr: 0, cb: 0, ft: 0, g: 0 }
    );

    setItems((list) =>
      list.map((r) =>
        r.uid !== uid
          ? r
          : {
              ...r,
              parts: [...(r.parts || []), ...added],
              calories: r.calories + gained.cal,
              protein: r.protein + gained.pr,
              carbs: r.carbs + gained.cb,
              fat: r.fat + gained.ft,
              grams: r.grams + gained.g,
              /* the user put this here by hand — voice corrections to the
                 whole plate must not overwrite it later */
              manual: true,
              justChanged: true,
              /* and it's no longer only the photo's guess */
              sure: "high",
            }
      )
    );

    setPartNote(note || `Added ${added.length === 1 ? added[0].name : `${added.length} ingredients`}.`);
    H.success();
    reopen();
  };

  /* ---------- the set-aside answers ---------- */
  const restoreAside = (uid: number) => {
    H.success();
    setItems((list) =>
      list.map((r) => (r.uid === uid ? { ...r, setAside: false, manual: true, justChanged: true } : r))
    );
  };

  const dropAside = (uid: number) => {
    H.tick();
    setItems((list) => list.filter((r) => r.uid !== uid));
  };

  /* ---------- what they said about the dish ---------- */
  const onTranscript = async (text: string) => {
    setVoiceOpen(false);
    setFixNote(null);
    setFixProblem(null);
    setFixing(true);

    const active = items.filter((r) => !r.setAside);
    const snapshot = active.map((r) => r as MealItem);
    const fix = await fixMealWithVoice(snapshot, text);

    setFixing(false);

    if (!fix.understood) {
      H.warn();
      setFixProblem(fix.problem || "MOTION wasn't sure what to change — try again?");
      return;
    }

    /* the model answered in positions; translate to uids before touching
       anything, because the list is about to change shape */
    const editByUid = new Map<number, MealItem & { parts?: MealPart[] }>();
    fix.edits.forEach(({ index, item }) => {
      const row = active[index];
      if (row) editByUid.set(row.uid, item);
    });

    const asideUids = new Set<number>();
    fix.removes.forEach((index) => {
      const row = active[index];
      if (row) asideUids.add(row.uid);
    });

    let skipped = 0;
    let gainedParts = 0;

    setItems((list) => {
      const next: Row[] = list.map((r) => {
        const base: Row = { ...r, justChanged: false };

        if (base.setAside) return base;

        /* HAND CORRECTIONS WIN */
        if (base.manual) {
          if (editByUid.has(base.uid) || asideUids.has(base.uid)) skipped++;
          return base;
        }

        const edit = editByUid.get(base.uid);
        if (edit) {
          if (edit.parts?.length) gainedParts++;
          return { ...base, ...edit, justChanged: true };
        }

        if (asideUids.has(base.uid)) return { ...base, setAside: true, justChanged: false };

        return base;
      });

      fix.adds.forEach((item) => {
        if (item.parts?.length) gainedParts++;
        next.push({ ...toRow(item), justChanged: true });
      });

      return next;
    });

    H.success();

    const bits: string[] = [];
    if (fix.note) bits.push(fix.note);
    /* SAY THE BREAKDOWN EXISTS. Nobody discovers a hold on their own, and a
       dish quietly gaining ingredients nobody opens is the same as not having
       them. */
    if (gainedParts > 0) {
      bits.push(
        gainedParts === 1
          ? "Hold the gold row to see what went into it."
          : "Hold a gold row to see what went into it."
      );
    }
    if (skipped > 0) bits.push("Your own corrections were left as they are.");

    setFixNote(bits.length ? bits.join(" ") : "Updated.");
  };

  /* ---------- the write ---------- */
  const logIt = async () => {
    if (saving || !counted.length) return;
    if (!userId) { setSaveErr("You're signed out — sign in and try again."); return; }

    setSaveErr(null);
    setSaving(true);

    const { mealId, error } = await saveMeal(userId, {
      mealType: meal.toLowerCase() as any,
      source: "photo",
      /* SET-ASIDE ITEMS DON'T GO. Ignoring the question is a valid answer. */
      items: counted.map((i) => ({
        foodName: i.name,
        amountLabel: i.amountLabel,
        grams: i.grams,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        source: i.manual || i.justChanged || i.sure === "high" ? "user" : "ai",
        /* the ingredients ride along, so the calendar can show them later */
        parts: i.parts,
      })),
    });

    setSaving(false);

    if (error || !mealId) {
      setSaveErr(error || "Couldn't save that meal.");
      H.warn();
      return;
    }

    /* THE MEAL IS ALREADY SAVED. The photo goes up afterwards and is NOT
       awaited — a slow or failed upload must not cost the user their meal.
       The upload needs the meal's id for its filename, which is why it can't
       happen earlier. Forgetting this call is what once left photo-logged
       meals on the calendar with no image at all. */
    if (photoUri) {
      uploadMealPhoto(userId, mealId, photoUri)
        .then(({ path }) => { if (path) setMealPhoto(mealId, path); })
        .catch(() => {});
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
        <Text style={s.doneSub}>
          {counted.length} {counted.length === 1 ? "item" : "items"} · {totals.cal} cal
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

  const anyShaky = counted.some((i) => i.sure === "low");

  /* one item row — a plain food, or a dish wearing the traveling gold border */
  const ItemRow = ({ item }: { item: Row }) => {
    const shaky = item.sure === "low";
    const col = colorFor(guessColorKey(item.name));
    const hasParts = !!item.parts?.length;

    const inner = (
      <View style={[s.item, !hasParts && s.itemPlain, shaky && !hasParts && s.itemShaky, item.justChanged && !hasParts && s.itemChanged]}>
        <LinearGradient
          colors={hasParts ? [T.gold, "#B45309"] : [col.from, col.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.itemStripe}
        />

        <View style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
          {hasParts ? (
            <View style={s.dishTag}>
              <Text style={s.dishTagText}>
                {item.parts!.length} INGREDIENTS · HOLD TO SEE
              </Text>
            </View>
          ) : item.justChanged ? (
            <View style={s.changedTag}>
              <Mic size={9} color={T.green} />
              <Text style={s.changedTagText}>FROM WHAT YOU SAID</Text>
            </View>
          ) : shaky ? (
            <View style={s.shakyTag}>
              <AlertTriangle size={9} color={T.gold} />
              <Text style={s.shakyTagText}>{SHAKY.label}</Text>
            </View>
          ) : null}

          <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={s.itemAmount}>
            {item.amountLabel} · about {item.grams} g
          </Text>

          {/* ADVERTISE THE HOLD ON PLAIN ROWS TOO. The dish tag above already
              says "hold to see"; a plain row said nothing, so the gesture may
              as well not have existed. A hidden gesture is only fair when it's
              announced — and this is the only place the per-item mic can be
              discovered from. */}
          {!hasParts ? (
            <Text style={s.holdHint}>Hold to add something MOTION missed</Text>
          ) : null}

          {shaky && !item.justChanged && !hasParts ? (
            <Text style={s.shakyNote}>{SHAKY.note}</Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={[s.itemCal, hasParts && { color: T.gold }]}>{item.calories}</Text>
          <Text style={s.itemCalUnit}>cal</Text>
        </View>

        <ChevronRight size={17} color={hasParts ? T.gold : T.micro} style={{ marginLeft: 8 }} />
      </View>
    );

    return (
      <Tap
        onPress={() => { H.tap(); setEditing(item.uid); }}
        /* EVERY row holds now — a plain one to add what was forgotten */
        onLongPress={() => holdRow(item.uid)}
      >
        {hasParts ? (
          /* the traveling gold light — the app's own shine, so the dish row
             catches the eye without inventing a new effect for it */
          <TravelBorder color={T.gold} cardBg={T.card} borderColor={`${T.gold}44`} radius={15}>
            {inner}
          </TravelBorder>
        ) : (
          inner
        )}
      </Tap>
    );
  };

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

        <View style={s.estimateRow}>
          <Sparkles size={14} color={T.green} />
          <Text style={s.estimateText}>MOTION'S ESTIMATE</Text>
        </View>

        <Text style={s.summary}>{summary || "Your meal"}</Text>

        {photoUri ? (
          <View style={s.photoWrap}>
            <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" />
          </View>
        ) : null}

        {/* the total — counted items only */}
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

        {/* TELL IT WHAT IT COULDN'T SEE — a photo shows the surface, and the
            calories hide in the oil underneath. */}
        <Tap
          onPress={() => { if (!fixing) { H.tap(); setVoiceOpen(true); } }}
          style={{ marginTop: 14 }}
        >
          <View style={[s.voiceRow, fixing && { opacity: 0.6 }]}>
            <View style={s.voiceIcon}>
              {fixing ? (
                <ActivityIndicator size="small" color={T.green} />
              ) : (
                <Icon name="mic" size={26} mode="loop" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.voiceTitle}>
                {fixing ? "Listening to what you said…" : "Describe this dish out loud"}
              </Text>
              <Text style={s.voiceSub}>
                {fixing
                  ? "Working out what to change"
                  : "The oil, the butter, what it really is — the things a photo can't show"}
              </Text>
            </View>
            <ChevronRight size={17} color={T.micro} />
          </View>
        </Tap>

        {fixNote ? (
          <View style={s.fixNoteRow}>
            <Check size={14} color={T.green} />
            <Text style={s.fixNoteText}>{fixNote}</Text>
          </View>
        ) : null}

        {fixProblem ? (
          <View style={s.fixProblemRow}>
            <AlertTriangle size={14} color={T.gold} />
            <Text style={s.fixProblemText}>
              {fixProblem}
              {"\n"}
              Nothing on your plate was changed.
            </Text>
          </View>
        ) : null}

        <View style={s.explainRow}>
          <CircleHelp size={13} color={T.micro} />
          <Text style={s.explainText}>
            Tap anything that looks off — MOTION can't see how much is under the sauce.
          </Text>
        </View>

        <Text style={[s.micro, { marginTop: 18, marginBottom: 10 }]}>
          {counted.length} {counted.length === 1 ? "item" : "items"}
        </Text>

        <View style={{ gap: 9 }}>
          {counted.map((item) => (
            <ItemRow key={item.uid} item={item} />
          ))}
        </View>

        {/* ---------- WHAT THE PHOTO SAW AND YOU DIDN'T MENTION ---------- */}
        {aside.length > 0 && (
          <View style={s.asideWrap}>
            <View style={s.asideHead}>
              <EyeOff size={13} color={T.gold} />
              <Text style={s.asideTitle}>Not counted</Text>
            </View>

            <Text style={s.asideIntro}>
              MOTION thought {aside.length === 1 ? "this was" : "these were"} in the photo, but you
              didn't mention {aside.length === 1 ? "it" : "them"} — so {aside.length === 1 ? "it isn't" : "they aren't"} in
              your total. Was {aside.length === 1 ? "it" : "any of it"} really there?
            </Text>

            {aside.map((item) => (
              <View key={item.uid} style={s.asideCard}>
                <View style={s.asideRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.asideName} numberOfLines={2}>{item.name}</Text>
                    <Text style={s.asideAmount}>
                      {item.amountLabel} · about {item.grams} g
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.asideCal}>{item.calories}</Text>
                    <Text style={s.asideCalUnit}>cal · not counted</Text>
                  </View>
                </View>

                <View style={s.asideBtns}>
                  <Tap onPress={() => restoreAside(item.uid)} style={{ flex: 1 }}>
                    <View style={s.asideKeep}>
                      <Plus size={13} color={T.ink} />
                      <Text style={s.asideKeepText}>It was there</Text>
                    </View>
                  </Tap>

                  <Tap onPress={() => dropAside(item.uid)} style={{ flex: 1 }}>
                    <View style={s.asideDrop}>
                      <X size={13} color={T.sub} />
                      <Text style={s.asideDropText}>It wasn't</Text>
                    </View>
                  </Tap>
                </View>
              </View>
            ))}

            <Text style={s.asideFoot}>
              Leave {aside.length === 1 ? "it" : "them"} alone and {aside.length === 1 ? "it won't" : "they won't"} be
              logged.
            </Text>
          </View>
        )}

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
          <View style={[s.logBtn, (saving || !counted.length) && { opacity: 0.55 }]}>
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

      {/* ---------- WHAT WENT INTO IT ----------
          Rises up like the camera sheet, because that's this app's language for
          "something has come forward". Read-only: these came from what the
          person said, and the way to change them is to say it again rather
          than tap through a ladder for every spoon of oil. */}
      <Modal visible={!!showingRow} transparent animationType="slide" onRequestClose={() => setShowing(null)}>
        <View style={{ flex: 1 }}>
          <Pressable style={s.partsBackdrop} onPress={() => setShowing(null)} />

          <View style={s.partsCentre} pointerEvents="box-none">
            {showingRow && (
              <TravelBorder color={T.gold} cardBg={T.bg} borderColor={`${T.gold}55`} radius={24} strokeWidth={2.5}>
                <View style={{ padding: 20 }}>
                  <View style={s.partsHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.partsLabel}>WHAT WENT INTO IT</Text>
                      <Text style={s.partsTitle}>{showingRow.name}</Text>
                      <Text style={s.partsSub}>{showingRow.amountLabel}</Text>
                    </View>
                    <Pressable onPress={() => setShowing(null)} hitSlop={12} style={s.partsClose}>
                      <X size={17} color={T.sub} />
                    </Pressable>
                  </View>

                  {showingRow.parts?.length ? (
                    <>
                      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                        {showingRow.parts.map((p, n) => (
                          <View key={`${showingRow.uid}-${n}`} style={s.partRow}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.partName} numberOfLines={1}>{p.name}</Text>
                              {p.amountLabel ? (
                                <Text style={s.partAmount} numberOfLines={1}>{p.amountLabel}</Text>
                              ) : null}
                            </View>
                            <Text style={s.partCal}>{p.calories} cal</Text>
                          </View>
                        ))}
                      </ScrollView>

                      <View style={s.partsTotalRow}>
                        <Text style={s.partsTotalLabel}>These add up to</Text>
                        <Text style={s.partsTotalCal}>
                          {Math.round(partsTotal(showingRow.parts).calories)} cal
                        </Text>
                      </View>
                    </>
                  ) : (
                    /* A PLAIN ROW HAS NO BREAKDOWN YET, and that's a normal
                       state rather than an empty list to apologise for — this
                       sheet is now reachable from every row, and most of them
                       are a single food with nothing inside them. */
                    <View style={s.partsEmpty}>
                      <Text style={s.partsEmptyText}>
                        Nothing listed inside this one yet. If you cooked it with something the
                        photo couldn't see — oil, butter, a spice — say so below and it gets
                        counted.
                      </Text>
                    </View>
                  )}

                  {/* ---------- ADD WHAT WAS FORGOTTEN ----------
                      THE MIC IS GREEN IN A GOLD FRAME. Lottie colours are baked
                      into the file — the five separate flame files exist for
                      exactly that reason — so a gold mic would mean a new
                      export. The frame carries the gold instead, which is how
                      gold works everywhere else in the app anyway: it's the
                      surround that means "this is exact", not the glyph. */}
                  {partBusy ? (
                    <View style={s.addPartBusy}>
                      <ActivityIndicator size="small" color={T.gold} />
                      <Text style={s.addPartBusyText}>Working out what that costs…</Text>
                    </View>
                  ) : (
                    <Tap
                      onPress={() => {
                        /* ⚠️ CLOSE THIS SHEET BEFORE OPENING THE VOICE ONE.
                           NEVER STACK MODALS. This sheet is a Modal, and so is
                           VoiceCapture — opening the second while the first is
                           up left iOS half-presenting it: the voice screen
                           never appeared, and the stuck modal sat over
                           everything swallowing taps. The logging screen went
                           completely dead while the other tabs carried on
                           working, which is exactly what that looks like.

                           The delay lets the dismissal finish; without it the
                           two animations overlap and it fails the same way. */
                        H.tap();
                        setPartErr(null);
                        setPartNote(null);
                        const uid = showingRow.uid;
                        setShowing(null);
                        setTimeout(() => setAddingTo(uid), 280);
                      }}
                      style={{ marginTop: 14 }}
                    >
                      <View style={s.addPartBtn}>
                        <View style={s.addPartMic}>
                          <Icon name="mic" size={22} mode="loop" />
                        </View>
                        <View style={{ flex: 1 }}>
                          {/* SAYS TAP, because it isn't obvious. Getting here
                              took a long-press on the row, so hold is the
                              natural guess — and a mic that does nothing when
                              held reads as broken rather than as the wrong
                              gesture. */}
                          <Text style={s.addPartTitle}>Tap to add something you forgot</Text>
                          <Text style={s.addPartSub}>
                            Say it out loud and you'll see the words as you talk. It joins this
                            dish — nothing else on the plate changes.
                          </Text>
                        </View>
                      </View>
                    </Tap>
                  )}

                  {/* what just happened, said once. A number changing with no
                      explanation is how a working feature looks broken. */}
                  {partNote ? (
                    <View style={s.partOkRow}>
                      <Check size={13} color={T.green} />
                      <Text style={s.partOkText}>{partNote}</Text>
                    </View>
                  ) : null}

                  {partErr ? (
                    <View style={s.partErrRow}>
                      <AlertTriangle size={13} color={T.gold} />
                      <Text style={s.partErrText}>{partErr}</Text>
                    </View>
                  ) : null}

                  <Text style={s.partsNote}>
                    Scaled to the portion you ate, not the whole pot. Tap the row itself to adjust
                    how much you had, and everything here moves with it.
                  </Text>
                </View>
              </TravelBorder>
            )}
          </View>
        </View>
      </Modal>

      {editingRow && (
        <AmountSheet
          visible
          name={editingRow.name}
          currentGrams={editingRow.grams}
          currentLabel={editingRow.amountLabel}
          perGram={{
            cal: editingRow.calories / (editingRow.grams || 1),
            p: editingRow.protein / (editingRow.grams || 1),
            c: editingRow.carbs / (editingRow.grams || 1),
            f: editingRow.fat / (editingRow.grams || 1),
          }}
          amounts={ladderFor(editingRow)}
          onClose={() => setEditing(null)}
          onChange={(r) => {
            applyEdit(editingRow.uid, r.grams, r.amountLabel);
            setEditing(null);
          }}
          onRemove={() => {
            removeItem(editingRow.uid);
            setEditing(null);
          }}
        />
      )}

      <FoodPicker
        visible={adding}
        title="Add to this meal"
        onClose={() => setAdding(false)}
        onPick={addPicked}
      />

      {/* ---------- EXACTLY ONE VOICE SHEET, EVER ----------
          ⚠️ THIS WAS TWO COMPONENTS AND IT FROZE THE SCREEN.

          expo-speech-recognition's events are GLOBAL — every mounted
          VoiceCapture receives every event, not just the visible one. With two
          mounted, finishing a sentence fired BOTH handlers: the per-item add
          priced an ingredient while the whole-plate handler simultaneously ran
          fixMealWithVoice and rewrote the entire list. Two AI calls racing to
          change the same rows, each instance's cleanup aborting the other's
          session — a log full of "Speech recognition aborted" and a logging
          screen that stopped responding while the rest of the app was fine.

          So there is one instance, mounted only while it's needed, and which
          handler runs depends on what opened it. Adding a third voice entry
          point later means extending `voiceFor`, never adding a component.

          "improve", not "describe": there's already a plate on screen, so
          asking "say what you ate" would be asking them to repeat what MOTION
          just told them. */}
      {voiceFor && (
        <VoiceCapture
          visible
          meal={meal}
          mode="improve"
          onClose={closeVoice}
          onTranscript={voiceFor === "plate" ? onTranscript : onPartTranscript}
        />
      )}
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
  if (/banana|plantain/.test(n)) return "banana";
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

    voiceRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
    },
    voiceIcon: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    voiceTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    voiceSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2, lineHeight: 16 },

    fixNoteRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 12, padding: 12,
    },
    fixNoteText: { flex: 1, fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },

    fixProblemRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 12, padding: 12,
    },
    fixProblemText: { flex: 1, fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },

    explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 16, paddingHorizontal: 2 },
    explainText: { flex: 1, fontSize: 11.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 16.5 },

    item: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: T.card,
      borderRadius: 15, paddingVertical: 13, paddingRight: 15,
      overflow: "hidden",
    },
    /* the border lives on TravelBorder for a dish, so only plain rows draw
       their own */
    itemPlain: { borderWidth: 1, borderColor: T.border },
    itemShaky: { borderColor: `${T.gold}44` },
    itemChanged: { borderColor: T.greenBorder, backgroundColor: T.greenBg },
    itemStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },

    shakyTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    shakyTagText: { fontSize: 8, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    changedTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    changedTagText: { fontSize: 8, letterSpacing: 0.8, color: T.green, fontFamily: FONTS.headingMed },

    dishTag: { marginBottom: 4 },
    dishTagText: { fontSize: 8, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    itemName: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    itemAmount: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    shakyNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 5, lineHeight: 15 },

    itemCal: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    itemCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    /* the ingredients sheet */
    partsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    partsCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    partsHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
    partsLabel: { fontSize: 9.5, letterSpacing: 1.2, color: T.gold, fontFamily: FONTS.body },
    partsTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, marginTop: 4 },
    partsSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    partsClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    partRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: T.border,
    },
    partName: { fontSize: 13.5, color: T.text, fontFamily: FONTS.body },
    partAmount: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },
    partCal: { fontSize: 13.5, color: T.gold, fontFamily: FONTS.headingMed },
    partsTotalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 },
    partsTotalLabel: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    partsTotalCal: { fontSize: 20, color: T.gold, fontFamily: FONTS.heading },
    /* the hold hint under a plain row */
    holdHint: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 5 },

    /* a row with nothing inside it yet */
    partsEmpty: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 14, marginTop: 4,
    },
    partsEmptyText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },

    /* GREEN MIC, GOLD FRAME — see the note where this is used */
    addPartBtn: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: "rgba(251,191,36,0.10)",
      borderWidth: 1, borderColor: `${T.gold}77`,
      borderRadius: 15, padding: 13,
    },
    addPartMic: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}55`,
      alignItems: "center", justifyContent: "center",
    },
    addPartTitle: { fontSize: 14, color: T.gold, fontFamily: FONTS.headingMed },
    addPartSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2, lineHeight: 16 },

    addPartBusy: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}44`,
      borderRadius: 15, paddingVertical: 16, marginTop: 14,
    },
    addPartBusyText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    partOkRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 12, padding: 11,
    },
    partOkText: { flex: 1, fontSize: 12, color: T.green, fontFamily: FONTS.body, lineHeight: 17 },

    partErrRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 12, padding: 11,
    },
    partErrText: { flex: 1, fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },

    partsNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15.5, marginTop: 12 },

    /* set aside — visible, uncounted, undecided */
    asideWrap: { marginTop: 18 },
    asideHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    asideTitle: { fontSize: 10, letterSpacing: 1.2, color: T.gold, fontFamily: FONTS.body, textTransform: "uppercase" },
    asideIntro: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17, marginBottom: 10 },
    asideCard: {
      backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}44`,
      borderRadius: 15, padding: 13, marginBottom: 9,
    },
    asideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    asideName: { fontSize: 14.5, color: T.sub, fontFamily: FONTS.headingMed },
    asideAmount: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },
    asideCal: { fontSize: 16, color: T.micro, fontFamily: FONTS.heading },
    asideCalUnit: { fontSize: 8.5, color: T.micro, fontFamily: FONTS.body },
    asideBtns: { flexDirection: "row", gap: 8, marginTop: 12 },
    asideKeep: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: T.green, borderRadius: 11, paddingVertical: 10,
    },
    asideKeepText: { fontSize: 12.5, color: T.ink, fontFamily: FONTS.headingMed },
    asideDrop: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 11, paddingVertical: 10,
    },
    asideDropText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },
    asideFoot: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15 },

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