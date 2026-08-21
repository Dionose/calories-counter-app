// components/AddFoodFlow.tsx
// Adding a food MOTION has never heard of.
//
// THE GAP THIS FILLS. Open Food Facts is volunteer-entered and USDA covers
// generic ingredients — between them they miss a lot of real supermarket
// products. A bag of large green lentils has a barcode, a nutrition panel and
// a name on the front, and none of it is in either database. Before this, that
// was a dead end: scan fails, search fails, and the user gives up on logging
// something they're holding in their hand.
//
// TWO PHOTOS, NO TYPING. The front for the name, the panel for the numbers.
// "Large green lentils" is a genuinely annoying thing to thumb into a phone
// while standing in a kitchen, and the camera is already open.
//
// ⚠️ CONFIRMING THE LABEL IS THE SAVE. It used to be that saving happened only
// if you took the "Save it and log it" path — so someone who photographed a
// carton of almond milk, confirmed the reading, then backed out without eating
// it lost everything. Scanning that carton again found nothing, twice over,
// with no error and no explanation. Found on a real product.
//
// The two acts are separate: photographing a packet is BUILDING YOUR FOOD
// LIBRARY, logging is saying you ate it. Someone cataloguing the cupboard
// shouldn't have to pretend to eat things. So confirming the reading writes
// the food, immediately, and whether they go on to log it is a different
// question.
//
// AND A FAILED SAVE STOPS EVERYTHING. The old code set an error message and
// then navigated away in the same breath, so the message was never seen — a
// silent failure dressed up as success. Now nothing moves until the write
// comes back.
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { AlertTriangle, BadgeCheck, Check, Pencil, RefreshCw, X } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useApp } from "../constants/AppState";
import { saveCustomFood } from "../constants/customFoods";
import { Amount, FoodDef } from "../constants/foods";
import * as H from "../constants/haptics";
import { LabelReading, per100From, readNutritionLabel } from "../constants/nutritionLabel";
import { readProductFront } from "../constants/productPhoto";
import { FONTS } from "../constants/theme";
import { IsoMGlow } from "./IsoM";
import LabelCamera from "./LabelCamera";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

type Step = "front" | "readingFront" | "typeName" | "panel" | "readingPanel" | "confirm" | "saved";

export type AddedFood = {
  food: FoodDef;
  /** null when the save failed and they chose to carry on anyway */
  savedId: string | null;
};

/* ---------- a loading state ---------- */
function Busy({ title, sub }: { title: string; sub?: string | null }) {
  const { T } = useApp();
  const s = styles(T);
  return (
    <View style={s.centre}>
      <IsoMGlow size={92} />
      <Text style={s.centreText}>{title}</Text>
      {sub ? <Text style={s.centreSub}>{sub}</Text> : null}
    </View>
  );
}

/** shrink a photo before sending.

    SMALL, DELIBERATELY. Packaging text is high-contrast print, which survives
    compression far better than a photo of food — and the upload is a real
    share of a wait the user sits through watching a spinner. 800px at 0.55
    lands around 100 KB and reads in about two seconds; the 1400px/0.9 version
    this started as was 600 KB and took twenty to forty. */
async function prepPhoto(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: 800 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.55, format: SaveFormat.JPEG });
  return FileSystem.readAsStringAsync(out.uri, { encoding: "base64" });
}

export default function AddFoodFlow({
  visible, meal, barcode, initialName, onClose, onDone,
}: {
  visible: boolean;
  meal: string;
  /** when they got here from a failed scan — saved so the same packet is
      recognised instantly next time */
  barcode?: string | null;
  /** what they'd typed into search before giving up, as a starting point */
  initialName?: string | null;
  onClose: () => void;
  onDone: (r: AddedFood) => void;
}) {
  const { T, userId } = useApp();
  const s = styles(T);

  const [step, setStep] = useState<Step>("front");
  const [progress, setProgress] = useState<string | null>(null);

  const [name, setName] = useState(initialName || "");
  const [brand, setBrand] = useState<string | null>(null);
  const [typed, setTyped] = useState(initialName || "");

  const [reading, setReading] = useState<LabelReading | null>(null);
  const [frontProblem, setFrontProblem] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  /* the food, built and kept once saved — so the "log it" button on the next
     screen doesn't have to rebuild it */
  const [savedFood, setSavedFood] = useState<FoodDef | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  /* ---------- PHOTO 1: what is it? ---------- */
  const readFront = async (uri: string) => {
    setProgress(null);
    setFrontProblem(null);
    setStep("readingFront");

    let b64: string;
    try {
      b64 = await prepPhoto(uri);
    } catch {
      setFrontProblem("Couldn't process that photo on this phone.");
      setStep("typeName");
      return;
    }

    const r = await readProductFront(b64, setProgress);
    setProgress(null);

    if (!r.confident || !r.name) {
      /* fall to typing rather than making them shoot again — they've already
         taken one photo that didn't work, and a second attempt at the same
         thing is more likely to annoy than succeed */
      setFrontProblem(r.problem || "Couldn't read the name off that one.");
      setTyped(initialName || "");
      setStep("typeName");
      H.warn();
      return;
    }

    setName(r.name);
    setBrand(r.brand);
    H.success();
    /* straight on to the panel — no confirmation screen in between, because
       the name gets shown for checking at the end anyway and stopping twice
       makes a two-photo flow feel like four steps */
    setStep("panel");
  };

  /* ---------- PHOTO 2: what's in it? ---------- */
  const readPanel = async (uri: string) => {
    setProgress(null);
    setStep("readingPanel");

    let b64: string;
    try {
      b64 = await prepPhoto(uri);
    } catch {
      setReading({
        servingText: null, servingGrams: null, servingMl: null,
        calories: null, protein: null, carbs: null, fat: null,
        servingsPerContainer: null, confident: false,
        problem: "Couldn't process that photo on this phone. Try taking it again.",
      });
      setStep("confirm");
      return;
    }

    const r = await readNutritionLabel(b64, setProgress);
    setProgress(null);
    setReading(r);
    setStep("confirm");
    if (r.confident) H.success(); else H.warn();
  };

  /** build the FoodDef from the reading. Pure — no saving, no navigation. */
  const buildFood = (finalName: string): FoodDef | null => {
    if (!reading) return null;
    const per100 = per100From(reading);
    if (!per100) return null;

    const servingG = reading.servingGrams ?? reading.servingMl ?? null;

    const measures: string[] = [];
    if (reading.servingMl) measures.push(`${Math.round(reading.servingMl)} ml`);
    if (reading.servingGrams) measures.push(`${Math.round(reading.servingGrams)} g`);
    else if (reading.servingMl) measures.push(`about ${Math.round(reading.servingMl)} g`);

    const labelRung: Amount = {
      label: reading.servingText || "One serving",
      hint: measures.length
        ? `${measures.join(", ")} — read from your packet`
        : "read from your packet",
      grams: Math.round(servingG || 100),
      ml: reading.servingMl ?? undefined,
      unit: "serving",
      unitPlural: "servings",
      exact: true,
    };

    return {
      name: brand ? `${finalName} · ${brand}` : finalName,
      sub: "your own",
      key: "greens",
      per100: per100.per100,
      p: per100.p,
      c: per100.c,
      f: per100.f,
      amounts: [
        labelRung,
        { label: "Half a serving", hint: `about ${Math.round((servingG || 100) / 2)} g`, grams: Math.round((servingG || 100) / 2) },
        { label: "Two servings", hint: `about ${Math.round((servingG || 100) * 2)} g`, grams: Math.round((servingG || 100) * 2) },
      ],
      defaultIndex: 0,
      countUnit: "serving",
      countUnitPlural: "servings",
      gramsPerUnit: servingG || 100,
      mlPerUnit: reading.servingMl ?? undefined,
    };
  };

  /* ---------- CONFIRMING THE LABEL — THIS IS THE SAVE ----------
     Nothing moves until the write comes back. A failure stays on this screen
     with the food still on it, because the alternative is what caused the bug
     this whole change exists to fix: an error prepared, then navigated past. */
  const confirmAndSave = async () => {
    if (saving || !reading) return;

    const per100 = per100From(reading);
    if (!per100) return;

    const finalName = (name || typed).trim();
    if (!finalName) {
      setSaveErr("Give it a name first — tap the name above to type one.");
      H.warn();
      return;
    }

    const food = buildFood(finalName);
    if (!food) return;

    if (!userId) {
      setSaveErr("You're signed out, so MOTION can't save this food. Sign in and try again.");
      H.warn();
      return;
    }

    setSaving(true);
    setSaveErr(null);

    const { id, error } = await saveCustomFood(userId, {
      name: finalName,
      brand,
      barcode,
      per100: per100.per100,
      protein: per100.p,
      carbs: per100.c,
      fat: per100.f,
      servingText: reading.servingText,
      servingGrams: reading.servingGrams,
      servingMl: reading.servingMl,
    });

    setSaving(false);

    if (error) {
      /* STAY PUT. They've taken two photos; losing that to a silent failure is
         the worst thing this screen could do. */
      setSaveErr(error);
      H.warn();
      return;
    }

    setSavedFood(food);
    setSavedId(id);
    H.success();
    setStep("saved");
  };

  /** they'd rather not keep it — log it once and it's gone.
      Rare, but someone eating a friend's snack shouldn't have it clutter
      their food list forever. */
  const logWithoutSaving = () => {
    const finalName = (name || typed).trim();
    if (!finalName) return;
    const food = buildFood(finalName);
    if (!food) return;
    H.tick();
    onDone({ food, savedId: null });
  };

  if (!visible) return null;

  /* ---------- loading ---------- */
  if (step === "readingFront") {
    return <Busy title="Working out what this is…" sub={progress || "A moment"} />;
  }
  if (step === "readingPanel") {
    return <Busy title="Reading the nutrition panel…" sub={progress || "A moment"} />;
  }

  /* ---------- PHOTO 1 ---------- */
  if (step === "front") {
    return (
      <LabelCamera
        visible
        mode="front"
        onClose={onClose}
        onCapture={readFront}
        onSkip={() => { H.tick(); setStep("typeName"); }}
      />
    );
  }

  /* ---------- TYPE IT INSTEAD ----------
     The escape hatch. Reached either by choosing it, or automatically when the
     front photo couldn't be read — because asking someone to retake a photo
     that just failed is more likely to annoy than to work. */
  if (step === "typeName") {
    return (
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56 }} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4, marginLeft: -4 }}>
              <X size={22} color={T.text} />
            </Pressable>
            <Text style={s.micro}>Add a food</Text>
            <View style={{ width: 22 }} />
          </View>

          <Text style={s.title}>What is it?</Text>
          <Text style={s.sub}>
            {frontProblem
              ? `${frontProblem} No matter — type it and MOTION will carry on.`
              : "Type what's on the front of the packet."}
          </Text>

          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Large green lentils"
            placeholderTextColor={T.micro}
            style={s.input}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (!typed.trim()) return;
              H.tap();
              setName(typed.trim());
              setStep("panel");
            }}
          />

          <Tap
            onPress={() => {
              if (!typed.trim()) return;
              H.tap();
              setName(typed.trim());
              setStep("panel");
            }}
            style={{ marginTop: 16 }}
          >
            <View style={[s.primaryBtn, !typed.trim() && { opacity: 0.4 }]}>
              <Text style={s.primaryBtnText}>Next — the nutrition panel</Text>
            </View>
          </Tap>

          {frontProblem ? (
            <Tap onPress={() => { H.tap(); setFrontProblem(null); setStep("front"); }} style={{ marginTop: 10 }}>
              <View style={s.ghostBtn}>
                <RefreshCw size={15} color={T.sub} />
                <Text style={s.ghostBtnText}>Try the photo again</Text>
              </View>
            </Tap>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ---------- PHOTO 2 ---------- */
  if (step === "panel") {
    return (
      <LabelCamera
        visible
        mode="panel"
        productName={brand ? `${name} · ${brand}` : name}
        onClose={onClose}
        onCapture={readPanel}
        /* no skip here — without the panel there are no numbers, and a food
           with no calories isn't worth saving */
        onSkip={undefined}
      />
    );
  }

  /* ---------- SAVED ----------
     A real screen rather than a toast, because the whole point of this change
     is that the user KNOWS the food is theirs now. From here, logging it is
     optional — closing this screen keeps the food. */
  if (step === "saved" && savedFood) {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
          <View style={s.savedWrap}>
            <View style={s.savedCircle}>
              <Check size={34} color={T.gold} />
            </View>

            <Text style={s.savedTitle}>Saved to your foods</Text>
            <Text style={s.savedName}>{savedFood.name}</Text>

            <Text style={s.savedBody}>
              It's yours now. {barcode
                ? "Scan this barcode again and MOTION will bring it straight up — no photos."
                : "Search for it by name and it'll be there."}
              {"\n\n"}
              You can close this without logging anything and it stays saved.
            </Text>

            <Tap onPress={() => onDone({ food: savedFood, savedId })} style={{ width: "100%", marginTop: 22 }}>
              <View style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>Log it to {meal.toLowerCase()}</Text>
              </View>
            </Tap>

            <Tap onPress={onClose} style={{ width: "100%", marginTop: 10 }}>
              <View style={s.secondaryBtn}>
                <Text style={s.secondaryBtnText}>Not eating it now — just save it</Text>
              </View>
            </Tap>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ---------- CONFIRM AND SAVE ---------- */
  const per100 = reading ? per100From(reading) : null;
  const usable = !!reading?.confident && !!per100;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4, marginLeft: -4 }}>
            <X size={22} color={T.text} />
          </Pressable>
          <Text style={s.micro}>Check it over</Text>
          <View style={{ width: 22 }} />
        </View>

        {usable && reading ? (
          <>
            <Text style={s.title}>Does this look right?</Text>
            <Text style={s.sub}>
              MOTION read all of this off your two photos. A quick look before it goes in —
              a misread number is worse than none, because it looks like it came from the label.
            </Text>

            {/* the name, editable in place. Photo reading is good but not
                perfect, and correcting a word is easier than starting over. */}
            <View style={s.nameCard}>
              <Text style={s.nameLabel}>WHAT IT IS</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={s.nameInput}
                placeholder="Name this food"
                placeholderTextColor={T.micro}
              />
              {brand ? <Text style={s.brandLine}>{brand}</Text> : null}
              <View style={s.editHint}>
                <Pencil size={11} color={T.micro} />
                <Text style={s.editHintText}>Tap to correct it</Text>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <TravelBorder color={T.gold} cardBg={T.card} borderColor={T.border} radius={18}>
                <View style={{ padding: 18 }}>
                  <View style={s.readHead}>
                    <BadgeCheck size={13} color={T.gold} />
                    <Text style={s.readHeadText}>READ FROM YOUR LABEL</Text>
                  </View>

                  {reading.servingText ? (
                    <>
                      <Text style={s.micro}>Serving size</Text>
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

            {/* A REAL FAILURE, SAID OUT LOUD. This is the message that used to
                be written and then navigated past. */}
            {saveErr ? (
              <View style={s.errRow}>
                <AlertTriangle size={14} color={T.red} />
                <Text style={s.errText}>
                  Couldn't save it: {saveErr}
                  {"\n\n"}
                  Nothing has been lost — tap the button again to retry, or log it just this once
                  below.
                </Text>
              </View>
            ) : null}

            {/* THE SAVE. Not a side effect of logging — this button IS the
                save, and it says so. */}
            <Tap onPress={confirmAndSave} style={{ marginTop: 18 }}>
              <View style={[s.primaryBtn, saving && { opacity: 0.6 }]}>
                <Text style={s.primaryBtnText}>
                  {saving ? "Saving…" : saveErr ? "Try saving again" : "Yes, that's my label — save it"}
                </Text>
              </View>
            </Tap>

            <Text style={s.saveNote}>
              MOTION keeps this food for you. {barcode
                ? "Scanning this barcode again brings it straight up, and it shows in search too."
                : "It'll show up in search from now on."} You don't have to log it now — saving and
              eating are two different things.
            </Text>

            <Tap onPress={logWithoutSaving} style={{ marginTop: 14 }}>
              <View style={s.secondaryBtn}>
                <Text style={s.secondaryBtnText}>Don't keep it — just log it this once</Text>
              </View>
            </Tap>

            <Tap onPress={() => { H.tap(); setSaveErr(null); setStep("panel"); }} style={{ marginTop: 10 }}>
              <View style={s.ghostBtn}>
                <RefreshCw size={15} color={T.sub} />
                <Text style={s.ghostBtnText}>Something's off — retake the panel</Text>
              </View>
            </Tap>
          </>
        ) : (
          <>
            <View style={s.failIcon}>
              <AlertTriangle size={26} color={T.gold} />
            </View>

            <Text style={s.title}>Couldn't read that panel</Text>
            <Text style={s.sub}>
              {reading?.problem || "The panel wasn't clear enough to read reliably."}
              {"\n\n"}
              Rather than guess at numbers going into your diary, MOTION would rather ask again.
            </Text>

            <View style={s.tipsCard}>
              <Text style={s.tipsTitle}>What usually helps</Text>
              <Text style={s.tipsBody}>
                Fill the frame with the panel — the serving line at the top and the numbers under
                it.
                {"\n\n"}
                Let the camera focus before you shoot; small print goes soft first.
                {"\n\n"}
                Flatten a curved packet, and angle away from bright light rather than under it.
              </Text>
            </View>

            <Tap onPress={() => { H.tap(); setStep("panel"); }} style={{ marginTop: 18 }}>
              <View style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>Take the panel again</Text>
              </View>
            </Tap>

            <Tap onPress={onClose} style={{ marginTop: 10 }}>
              <View style={s.ghostBtn}>
                <Text style={s.ghostBtnText}>Give up on this one</Text>
              </View>
            </Tap>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: T.bg, paddingHorizontal: 40 },
    centreText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed, textAlign: "center" },
    centreSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 17 },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },

    title: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    sub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 8, lineHeight: 18.5 },

    input: {
      marginTop: 22,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
      fontSize: 16, color: T.text, fontFamily: FONTS.headingMed,
    },

    nameCard: {
      marginTop: 20,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14,
    },
    nameLabel: { fontSize: 9, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body },
    nameInput: {
      fontSize: 18, color: T.text, fontFamily: FONTS.headingMed,
      marginTop: 4, padding: 0,
    },
    brandLine: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    editHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
    editHintText: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },

    readHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    readHeadText: { fontSize: 9, letterSpacing: 1, color: T.gold, fontFamily: FONTS.headingMed },
    readServing: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginTop: 3, marginBottom: 12 },
    readCalRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    readCalNum: { fontSize: 40, color: T.gold, fontFamily: FONTS.heading },
    readCalUnit: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },
    readMacros: { flexDirection: "row", gap: 8, marginTop: 16 },
    readMacro: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    readMacroNum: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    readMacroKey: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

    primaryBtn: { backgroundColor: T.gold, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    primaryBtnText: { fontSize: 14.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    saveNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 10, lineHeight: 16, paddingHorizontal: 6 },

    secondaryBtn: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, alignItems: "center",
    },
    secondaryBtnText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },

    ghostBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 12,
    },
    ghostBtnText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    /* saved */
    savedWrap: { alignItems: "center", paddingTop: 40, gap: 8 },
    savedCircle: {
      width: 78, height: 78, borderRadius: 39,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: `${T.gold}66`,
      alignItems: "center", justifyContent: "center", marginBottom: 10,
    },
    savedTitle: { fontSize: 11, letterSpacing: 1.2, color: T.gold, fontFamily: FONTS.headingMed, textTransform: "uppercase" },
    savedName: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginTop: 4 },
    savedBody: {
      fontSize: 12.5, color: T.sub, fontFamily: FONTS.body,
      textAlign: "center", lineHeight: 19, marginTop: 12, paddingHorizontal: 6,
    },

    failIcon: {
      width: 58, height: 58, borderRadius: 19, alignSelf: "center",
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: `${T.gold}55`,
      alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 14,
    },
    tipsCard: {
      marginTop: 18, backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 15,
    },
    tipsTitle: { fontSize: 12.5, color: T.gold, fontFamily: FONTS.headingMed, marginBottom: 8 },
    tipsBody: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17.5 },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12, color: T.red, fontFamily: FONTS.body, lineHeight: 17 },
  });