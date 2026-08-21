// components/BarcodeResult.tsx
// What a barcode scan lands on.
//
// THE STAGES, and the order matters:
//
//   1. FOUND — the product name, and nothing else. No calories yet, because
//      showing numbers first invites the user to accept them before we've
//      offered the better route.
//   2. LABEL — snap the nutrition panel, or skip. The panel is read by
//      Gemini and gives the manufacturer's exact figures.
//   3. RESULT — the amount ladder and the log button.
//
// AND WHEN THE SCAN FINDS NOTHING, that's no longer a dead end. AddFoodFlow
// takes two photos and saves the food against this barcode.
//
// ⚠️ CONFIRMING A LABEL SAVES IT — EVEN FOR A PRODUCT THE DATABASE KNEW.
// Open Food Facts is volunteer-entered: it often has a product's per-100g
// figures but a vague or missing serving size, which is exactly why this
// screen offers the panel photo in the first place. That reading used to be
// thrown away the moment the meal was logged, so the same carton got
// photographed again next week and the week after.
//
// A user's own label reading BEATS the database permanently, not just for one
// meal. So confirming it writes a custom food against this barcode, and the
// lookup at the top of this file finds it first from then on. Same rule as
// AddFoodFlow, which had the same bug and was fixed first: photographing is
// building your library, logging is saying you ate it, and the two are
// separate acts.
//
// NOTHING READ FROM A PHOTO IS APPLIED SILENTLY. A misread panel is WORSE than
// no panel: the user trusts it because it came from their own label. So the
// figures are shown for confirmation first.
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, BadgeCheck, Camera, Check, ChevronRight, Info, Minus, Plus, RefreshCw, ScanLine, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { customToFoodDef, findCustomByBarcode, saveCustomFood } from "../constants/customFoods";
import { lookupBarcode } from "../constants/foodApi";
import { colorFor } from "../constants/foodColors";
import { Amount, FoodDef, nutritionFor, rungDetail, rungLabel } from "../constants/foods";
import * as H from "../constants/haptics";
import { saveMeal } from "../constants/meals";
import { LabelReading, per100From, readNutritionLabel } from "../constants/nutritionLabel";
import { FONTS } from "../constants/theme";
import AddFoodFlow from "./AddFoodFlow";
import AmountSheet from "./AmountSheet";
import Icon from "./Icon";
import { IsoMGlow } from "./IsoM";
import LabelCamera from "./LabelCamera";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

type Stage = "looking" | "found" | "reading" | "confirm" | "result" | "done" | "missing" | "adding";

/* ---------- a loading state ---------- */
function Busy({ title, sub }: { title: string; sub?: string | null }) {
  const { T } = useApp();
  const s = styles(T);
  return (
    <View style={s.centre}>
      <IsoMGlow size={92} />
      <Text style={s.centreText}>{title}</Text>
      {sub ? <Text style={s.centreCode}>{sub}</Text> : null}
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
  code?: string | null;
  onExit: () => void;
  onRescan: () => void;
}) {
  const { T, userId, refreshStreak } = useApp();
  const s = styles(T);

  const [stage, setStage] = useState<Stage>("looking");
  const [food, setFood] = useState<FoodDef | null>(null);
  /* the name as the database gave it, kept for saving — food.name may have
     the brand appended for display */
  const [rawName, setRawName] = useState<string>("");

  const [reading, setReading] = useState<LabelReading | null>(null);
  const [fromLabel, setFromLabel] = useState(false);
  /* this food came from the user's own saved list, matched on the barcode */
  const [fromSaved, setFromSaved] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(1);
  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  /* keeping the label reading for next time — separate from logging the meal */
  const [keeping, setKeeping] = useState(false);
  const [keepErr, setKeepErr] = useState<string | null>(null);
  const [kept, setKept] = useState(false);

  /* ---------- THE LOOKUP ----------
     THE USER'S OWN FOODS FIRST. Someone who photographed this packet once
     shouldn't be asked to do it again — and their own entry beats anything a
     volunteer typed into a database on the other side of the world. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!code) { setStage("missing"); return; }

      if (userId) {
        const own = await findCustomByBarcode(userId, code);
        if (cancelled) return;
        if (own) {
          const f = customToFoodDef(own);
          setFood(f);
          setRawName(own.name);
          setIdx(0);
          setCount(1);
          setFromSaved(true);
          H.success();
          /* straight to the result — there's nothing to photograph, they
             already did it */
          setStage("result");
          return;
        }
      }

      const f = await lookupBarcode(code);
      if (cancelled) return;

      if (!f) { setStage("missing"); return; }

      setFood(f);
      setRawName(f.name);
      setIdx(f.defaultIndex);
      setCount(1);
      H.success();
      setStage("found");
    })();

    return () => { cancelled = true; };
  }, [code, userId]);

  /* ---------- READING THE PANEL ----------
     The image work and the API call are in SEPARATE try blocks on purpose.
     They were together once, and a throw anywhere in the chain replaced a
     perfectly good reading with a "couldn't read that" blank — so the terminal
     showed correct figures while the screen showed a failure. */
  const readLabel = async (uri: string) => {
    setProgress(null);
    setStage("reading");

    let b64: string;

    try {
      /* SMALL, DELIBERATELY. Packaging text is high-contrast print, which
         survives compression far better than a photo of food — and the upload
         is a real share of a wait the user sits through watching a spinner.
         The progression was 1400px/0.9 (≈600 KB, 20–40 s), then 1000px/0.65,
         now 800px/0.55 at ≈100 KB and about two seconds.

         IF READINGS START COMING BACK UNCONFIDENT on genuinely clear photos,
         raise these first. */
      const ctx = ImageManipulator.manipulate(uri).resize({ width: 800 });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ compress: 0.55, format: SaveFormat.JPEG });
      b64 = await FileSystem.readAsStringAsync(out.uri, { encoding: "base64" });

      console.log("LABEL: sending ≈", Math.round(b64.length * 0.75 / 1024), "KB");
    } catch (e: any) {
      console.log("LABEL: image prep failed →", e?.message || e);
      setReading({
        servingText: null, servingGrams: null, servingMl: null,
        calories: null, protein: null, carbs: null, fat: null,
        servingsPerContainer: null, confident: false,
        problem: "Couldn't process that photo on this phone. Try taking it again.",
      });
      setStage("confirm");
      return;
    }

    const r = await readNutritionLabel(b64, setProgress);

    setProgress(null);
    setReading(r);
    setStage("confirm");
    if (r.confident) H.success(); else H.warn();
  };

  /** build the food from the LABEL'S numbers — pure, no saving */
  const foodFromReading = (r: LabelReading): FoodDef | null => {
    if (!food) return null;

    const per100 = per100From(r);
    if (!per100) return null;

    const servingG = r.servingGrams ?? r.servingMl ?? null;

    /* EVERY MEASURE THE LABEL GAVE. Someone who thinks in cups, someone who
       thinks in ml and someone who thinks in grams are all looking at the same
       rung, and each should find their own unit without converting anything. */
    const measures: string[] = [];
    if (r.servingMl) measures.push(`${Math.round(r.servingMl)} ml`);
    if (r.servingGrams) measures.push(`${Math.round(r.servingGrams)} g`);
    else if (r.servingMl) measures.push(`about ${Math.round(r.servingMl)} g`);

    const labelRung: Amount = {
      label: r.servingText || "One serving",
      hint: measures.length
        ? `${measures.join(", ")} — read from your packet`
        : "read from your packet",
      grams: Math.round(servingG || 100),
      ml: r.servingMl ?? undefined,
      unit: "serving",
      unitPlural: "servings",
      exact: true,
    };

    const others = food.amounts.filter(
      (a) => !a.exact && Math.abs(a.grams - (servingG || 0)) > (servingG || 100) * 0.08
    );

    return {
      ...food,
      per100: per100.per100,
      p: per100.p,
      c: per100.c,
      f: per100.f,
      amounts: [labelRung, ...others],
      defaultIndex: 0,
    };
  };

  /** ---------- ACCEPT THE READING — AND KEEP IT ----------
      This is the fix. The reading is applied to the food on screen AND written
      against this barcode, so scanning this product again brings back the
      user's own figures rather than the database's vague ones.

      A failed save does NOT block them. Unlike AddFoodFlow — where a failure
      means losing two photos and the whole food — here there's a perfectly
      good reading already on screen and a meal waiting to be logged. Losing
      "we'll remember this" is a smaller loss than blocking the log, so it
      warns and carries on. */
  const acceptReading = async () => {
    if (!food || !reading || keeping) return;

    const next = foodFromReading(reading);
    if (!next) { setStage("result"); return; }

    const per100 = per100From(reading);

    if (userId && code && per100) {
      setKeeping(true);
      setKeepErr(null);

      const { error } = await saveCustomFood(userId, {
        name: rawName || food.name,
        brand: null,
        barcode: code,
        per100: per100.per100,
        protein: per100.p,
        carbs: per100.c,
        fat: per100.f,
        servingText: reading.servingText,
        servingGrams: reading.servingGrams,
        servingMl: reading.servingMl,
      });

      setKeeping(false);

      if (error) {
        console.log("BARCODE: couldn't keep label reading →", error);
        setKeepErr(error);
      } else {
        setKept(true);
      }
    }

    setFood(next);
    setIdx(0);
    setCount(1);
    setFromLabel(true);
    H.success();
    setStage("result");
  };

  /* ---------- LOOKING ---------- */
  if (stage === "looking") return <Busy title="Looking up that barcode…" sub={code} />;
  if (stage === "reading") {
    return <Busy title="Reading the label…" sub={progress || "A few seconds"} />;
  }

  /* ---------- ADDING IT YOURSELF ----------
     The barcode goes in, so scanning this packet again finds their own entry
     rather than the not-found screen a second time. */
  if (stage === "adding") {
    return (
      <AddFoodFlow
        visible
        meal={meal}
        barcode={code}
        onClose={() => setStage("missing")}
        onDone={({ food: f }) => {
          setFood(f);
          setRawName(f.name);
          setIdx(0);
          setCount(1);
          setFromLabel(true);
          setKept(true);
          setStage("result");
        }}
      />
    );
  }

  /* ---------- NOT FOUND ---------- */
  if (stage === "missing" || !food) {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
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

            <Text style={s.missTitle}>Not in the database</Text>

            <Text style={s.missBody}>
              That product isn't listed — the database is built by volunteers, so it covers most
              supermarket brands but misses local and own-brand items. It might also not be food
              at all.
              {code ? `\n\nScanned: ${code}` : ""}
            </Text>

            {/* THE WAY OUT, first and prominent. This screen used to end here,
                and the user gave up on logging something they were holding. */}
            <Tap onPress={() => { H.tap(); setStage("adding"); }} style={{ width: "100%", marginTop: 18 }}>
              <View style={s.rescueCard}>
                <View style={s.rescueIcon}>
                  <Camera size={18} color={T.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rescueTitle}>Add it yourself</Text>
                  <Text style={s.rescueBody}>
                    Two photos — the front of the packet and the nutrition panel — and MOTION
                    reads the rest. No typing.
                    {"\n\n"}
                    Save it once and scanning this barcode will find it straight away from now on.
                  </Text>
                </View>
              </View>
            </Tap>

            <Text style={s.missOr}>or</Text>

            <Tap onPress={onExit} style={{ width: "100%" }}>
              <View style={s.missGhost}>
                <Text style={s.missGhostText}>Search for it by name</Text>
              </View>
            </Tap>

            <Tap onPress={onRescan} style={{ width: "100%", marginTop: 10 }}>
              <View style={s.missGhost}>
                <Text style={s.missGhostText}>Scan a different barcode</Text>
              </View>
            </Tap>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ---------- FOUND — the panel offer ---------- */
  if (stage === "found") {
    return (
      <LabelCamera
        visible
        mode="panel"
        productName={food.name}
        onClose={onExit}
        onCapture={readLabel}
        onSkip={() => { H.tick(); setStage("result"); }}
      />
    );
  }

  /* ---------- CONFIRM WHAT WE READ ---------- */
  if (stage === "confirm" && reading) {
    const per100 = per100From(reading);
    const usable = reading.confident && !!per100;

    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
          <View style={s.head}>
            <Pressable onPress={() => setStage("found")} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
              <X size={22} color={T.text} />
            </Pressable>
            <Text style={s.micro}>Check the reading</Text>
            <View style={{ width: 22 }} />
          </View>

          {usable ? (
            <>
              <Text style={s.confirmTitle}>Does this match your packet?</Text>
              <Text style={s.confirmSub}>
                MOTION read these off your photo. Have a quick look before it goes in your diary —
                a misread number is worse than none, because it looks like it came from the label.
              </Text>

              <View style={{ marginTop: 20 }}>
                <TravelBorder color={T.gold} cardBg={T.card} borderColor={T.border} radius={18}>
                  <View style={{ padding: 18 }}>
                    <View style={s.readHead}>
                      <BadgeCheck size={13} color={T.gold} />
                      <Text style={s.readHeadText}>READ FROM YOUR LABEL</Text>
                    </View>

                    {reading.servingText ? (
                      <>
                        <Text style={s.readServingLabel}>Serving size</Text>
                        <Text style={s.readServing}>{reading.servingText}</Text>
                      </>
                    ) : null}

                    <View style={s.readCalRow}>
                      <Text style={s.readCalNum}>{reading.calories}</Text>
                      <Text style={s.readCalUnit}>calories per serving</Text>
                    </View>

                    <View style={s.readMacros}>
                      {[
                        ["Protein", reading.protein],
                        ["Carbs", reading.carbs],
                        ["Fat", reading.fat],
                      ].map(([k, v]: any) => (
                        <View key={k} style={s.readMacro}>
                          <Text style={s.readMacroNum}>{v != null ? `${v}g` : "—"}</Text>
                          <Text style={s.readMacroKey}>{k}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TravelBorder>
              </View>

              {/* THE SAVE, and it says so. The database's serving size is often
                  vague or missing — this reading is better, and it should
                  outlive this one meal. */}
              <Tap onPress={acceptReading} style={{ marginTop: 18 }}>
                <View style={[s.confirmBtn, keeping && { opacity: 0.6 }]}>
                  <Text style={s.confirmBtnText}>
                    {keeping ? "Saving…" : "Yes, that's my label — save it"}
                  </Text>
                </View>
              </Tap>

              <Text style={s.keepNote}>
                MOTION keeps these figures against this barcode. Scan this product again and your
                own reading comes back — no photo, and no vague database serving size.
              </Text>

              <Tap onPress={() => { H.tap(); setStage("found"); }} style={{ marginTop: 12 }}>
                <View style={s.retryBtn}>
                  <RefreshCw size={15} color={T.sub} />
                  <Text style={s.retryText}>Something's off — take it again</Text>
                </View>
              </Tap>

              <Tap onPress={() => { H.tick(); setStage("result"); }} style={{ marginTop: 10 }}>
                <View style={s.ghostBtn}>
                  <Text style={s.ghostText}>Use the database figures instead</Text>
                </View>
              </Tap>
            </>
          ) : (
            <>
              <View style={s.failIcon}>
                <AlertTriangle size={26} color={T.gold} />
              </View>

              <Text style={s.confirmTitle}>Couldn't read that one</Text>
              <Text style={s.confirmSub}>
                {reading.problem || "The panel wasn't clear enough to read reliably."}
                {"\n\n"}
                Rather than guess at numbers going into your diary, MOTION would rather ask again.
              </Text>

              <View style={s.tipsCard}>
                <View style={s.tipsHead}>
                  <Info size={13} color={T.gold} />
                  <Text style={s.tipsTitle}>What usually helps</Text>
                </View>
                <Text style={s.tipsBody}>
                  Fill the frame with the panel — the serving line at the top and the numbers
                  under it.
                  {"\n\n"}
                  Let the camera focus before you shoot; small print goes soft first.
                  {"\n\n"}
                  Flatten a curved packet, and angle away from bright light rather than under it.
                </Text>
              </View>

              <Tap onPress={() => { H.tap(); setStage("found"); }} style={{ marginTop: 18 }}>
                <View style={s.confirmBtn}>
                  <Text style={s.confirmBtnText}>Take another photo</Text>
                </View>
              </Tap>

              <Tap onPress={() => { H.tick(); setStage("result"); }} style={{ marginTop: 10 }}>
                <View style={s.ghostBtn}>
                  <Text style={s.ghostText}>Use the database figures instead</Text>
                </View>
              </Tap>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ---------- the amount, and the log ---------- */
  const rung = food.amounts[idx] ?? food.amounts[0];
  const countable = !!rung?.unit;
  const gold = !!rung?.exact;
  const hasAnyExact = food.amounts.some((a) => a.exact);
  const grams = (rung?.grams ?? 0) * count;
  const label = countable && count > 1 ? rungLabel(rung, count) : rung?.label ?? "";
  const n = nutritionFor(food, grams);

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
        source: fromLabel || fromSaved ? "label" : "barcode",
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
    setStage("done");
  };

  /* ---------- logged ---------- */
  if (stage === "done") {
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

        {/* where these numbers came from — four provenances now, and the user
            deserves to know which */}
        <View style={s.exactRow}>
          <Icon name="barcode" size={15} mode="loop" />
          <Text style={[s.exactText, !hasAnyExact && !fromLabel && !fromSaved && { color: T.sub }]}>
            {fromSaved
              ? "ONE OF YOUR OWN FOODS"
              : fromLabel
                ? "READ FROM YOUR OWN LABEL"
                : hasAnyExact
                  ? "EXACT · FROM THE LABEL"
                  : "FROM THE LABEL · AMOUNT ESTIMATED"}
          </Text>
        </View>

        <Text style={s.productName}>{food.name}</Text>
        {code ? <Text style={s.codeLine}>Barcode {code}</Text> : null}

        {/* IT'S KEPT — said once, quietly. They tapped a button that promised
            this, and a promise with no confirmation is how the last bug went
            unnoticed for so long. */}
        {kept && fromLabel && (
          <View style={s.keptRow}>
            <Check size={13} color={T.gold} />
            <Text style={s.keptText}>
              Saved to your foods — scanning this barcode again brings your own reading straight
              back.
            </Text>
          </View>
        )}

        {/* and when it DIDN'T save, say that too rather than pretending */}
        {keepErr && fromLabel && (
          <View style={s.keepFailRow}>
            <AlertTriangle size={13} color={T.sub} />
            <Text style={s.keepFailText}>
              MOTION couldn't save these figures for next time, but they're being used for this
              meal. You can scan again later to retry.
            </Text>
          </View>
        )}

        {!hasAnyExact && !fromLabel && !fromSaved && (
          <Tap onPress={() => { H.tap(); setStage("found"); }} style={{ marginTop: 16 }}>
            <View style={s.checkCard}>
              <View style={s.checkHead}>
                <Info size={14} color={T.gold} />
                <Text style={s.checkTitle}>Snap the label for exact numbers</Text>
              </View>
              <Text style={s.checkBody}>
                The nutrition here came off this product's label, but the database didn't record
                what it calls one serving — so the amounts below are MOTION's estimates.
                {"\n\n"}
                Photographing the panel takes a second, gets the manufacturer's own figures, and
                MOTION keeps them for every time you scan this product from now on.
              </Text>
            </View>
          </Tap>
        )}

        <Tap onPress={() => { H.tap(); setEditing(true); }} style={{ marginTop: 14 }}>
          <View style={[s.amountRow, gold && s.amountRowGold]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {gold ? (
                <View style={s.exactTag}>
                  <BadgeCheck size={11} color={T.gold} />
                  <Text style={s.exactTagText}>
                    {fromSaved ? "FROM THE LABEL YOU SAVED" : fromLabel ? "READ FROM YOUR LABEL" : "EXACTLY AS THE PACK STATES IT"}
                  </Text>
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
              {!hasAnyExact && !fromLabel && !fromSaved && (
                <Text style={s.per100Note}>
                  These per-100 g figures are the label's own. Only the portion size below is
                  estimated.
                </Text>
              )}
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

    centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: T.bg, paddingHorizontal: 40 },
    centreText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    centreCode: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 17 },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },

    confirmTitle: { fontSize: 21, color: T.text, fontFamily: FONTS.heading, marginTop: 6 },
    confirmSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 8, lineHeight: 18.5 },

    readHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    readHeadText: { fontSize: 9, letterSpacing: 1, color: T.gold, fontFamily: FONTS.headingMed },
    readServingLabel: { fontSize: 10, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    readServing: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginTop: 3, marginBottom: 12 },
    readCalRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    readCalNum: { fontSize: 40, color: T.gold, fontFamily: FONTS.heading },
    readCalUnit: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },
    readMacros: { flexDirection: "row", gap: 8, marginTop: 16 },
    readMacro: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    readMacroNum: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    readMacroKey: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

    confirmBtn: { backgroundColor: T.gold, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    confirmBtnText: { fontSize: 14.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    keepNote: {
      fontSize: 10.5, color: T.micro, fontFamily: FONTS.body,
      textAlign: "center", marginTop: 10, lineHeight: 16, paddingHorizontal: 6,
    },
    retryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14,
    },
    retryText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
    ghostBtn: { alignItems: "center", paddingVertical: 12 },
    ghostText: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body },

    failIcon: {
      width: 58, height: 58, borderRadius: 19, alignSelf: "center",
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: `${T.gold}55`,
      alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 14,
    },
    tipsCard: {
      marginTop: 18, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15,
    },
    tipsHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    tipsTitle: { fontSize: 12.5, color: T.gold, fontFamily: FONTS.headingMed },
    tipsBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    exactRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    exactText: { fontSize: 10, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.body },
    productName: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, lineHeight: 28 },
    codeLine: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 4, letterSpacing: 0.5 },

    keptRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
      backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}44`,
      borderRadius: 12, padding: 11,
    },
    keptText: { flex: 1, fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 16.5 },

    keepFailRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 12, padding: 11,
    },
    keepFailText: { flex: 1, fontSize: 11, color: T.micro, fontFamily: FONTS.body, lineHeight: 16 },

    checkCard: {
      backgroundColor: "rgba(251,191,36,0.07)",
      borderWidth: 1, borderColor: `${T.gold}55`,
      borderRadius: 15, padding: 15,
    },
    checkHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    checkTitle: { flex: 1, fontSize: 13, color: T.gold, fontFamily: FONTS.headingMed },
    checkBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    amountRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 16, padding: 16,
    },
    amountRowGold: { borderColor: `${T.gold}66`, backgroundColor: "rgba(251,191,36,0.07)" },
    exactTag: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
    exactTagText: { fontSize: 8.5, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed },

    amountLabel: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginTop: 4 },
    amountHint: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 15.5 },
    amountCal: { fontSize: 17, color: T.green, fontFamily: FONTS.heading },
    amountCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    countRow: {
      flexDirection: "row", alignItems: "center", marginTop: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 15, paddingVertical: 11, paddingHorizontal: 13,
    },
    countRowGold: { backgroundColor: "rgba(251,191,36,0.07)", borderColor: `${T.gold}55` },
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
    per100Note: { fontSize: 10.5, color: T.gold, fontFamily: FONTS.body, marginTop: 8, lineHeight: 15 },

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
    missWrap: { alignItems: "center", paddingTop: 24, gap: 10 },
    missIcon: {
      width: 62, height: 62, borderRadius: 20,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    missTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    missBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18.5 },
    missOr: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginVertical: 4 },

    rescueCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 13,
      backgroundColor: "rgba(251,191,36,0.10)",
      borderWidth: 1, borderColor: `${T.gold}77`,
      borderRadius: 16, padding: 16,
    },
    rescueIcon: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: T.card, borderWidth: 1, borderColor: `${T.gold}44`,
      alignItems: "center", justifyContent: "center",
    },
    rescueTitle: { fontSize: 15, color: T.gold, fontFamily: FONTS.headingMed },
    rescueBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 4, lineHeight: 17.5 },

    missGhost: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, alignItems: "center",
    },
    missGhostText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },

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