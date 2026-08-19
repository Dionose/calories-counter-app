// components/ResultFlow.tsx
// What happens after the shutter: analysing → the detected plate → optionally
// the voice refinement → logged.
//
// Every item carries GRAMS plus a plain-English label for how much it is.
// Editing means picking a different sentence — "half an avocado", "a big
// bowl" — never a multiplier. The amount sheet lives in its own file since the
// exact-number path made it big enough to own one.
//
// "Log to breakfast" is a REAL WRITE: the meal, its items, and the photo.
// The AI itself is still stand-in — the plate below is always eggs and rice —
// but everything the user confirms is stored and read back everywhere else.
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, Camera, Check, ChevronRight, Crown, Mic, PenLine, Plus, Send, Sparkles, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { colorFor } from "../constants/foodColors";
import * as H from "../constants/haptics";
import { saveMeal, setMealPhoto } from "../constants/meals";
import { uploadMealPhoto } from "../constants/photos";
import { FONTS } from "../constants/theme";
import AmountSheet from "./AmountSheet";
import FoodPicker, { PickedFood } from "./FoodPicker";
import Icon from "./Icon";
import { IsoMGlow } from "./IsoM";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

/* An item on the plate. GRAMS is the source of truth; `amountLabel` is how we
   say it out loud. `edited` marks anything the user changed, so the header can
   stop crediting the AI for it. */
type Item = {
  name: string;
  key: string;
  grams: number;
  amountLabel: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  edited?: boolean;
};

/* what the AI "saw" — each with the amount it assumed */
const BASE: Item[] = [
  { name: "Scrambled eggs", key: "eggs", grams: 120, amountLabel: "2 eggs", cal: 179, p: 12, c: 2, f: 13 },
  { name: "Avocado", key: "avocado", grams: 75, amountLabel: "Half an avocado", cal: 120, p: 2, c: 7, f: 11 },
  { name: "Cherry tomatoes", key: "tomato", grams: 100, amountLabel: "A small handful", cal: 18, p: 1, c: 4, f: 0 },
  { name: "White rice", key: "rice", grams: 180, amountLabel: "A normal serving", cal: 234, p: 5, c: 50, f: 1 },
];

/* what it becomes once you've described the meal properly */
const IMPROVED: Item[] = [
  { name: "Scrambled eggs", key: "eggs", grams: 180, amountLabel: "3 eggs", cal: 268, p: 18, c: 3, f: 20 },
  { name: "Avocado", key: "avocado", grams: 150, amountLabel: "A whole avocado", cal: 240, p: 3, c: 14, f: 23 },
  { name: "Cherry tomatoes", key: "tomato", grams: 200, amountLabel: "A big handful", cal: 36, p: 2, c: 8, f: 0 },
  { name: "White rice", key: "rice", grams: 280, amountLabel: "A big serving", cal: 364, p: 8, c: 78, f: 1 },
];

/* ---------- one food bar ---------- */
function FoodBar({ item, maxCal, onPress }: { item: Item; maxCal: number; onPress: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const col = colorFor(item.key);

  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,   // animating width
    }).start();
  }, []);

  // never shrink below the width the macro line needs to stay readable
  const target = Math.max(58, Math.min(100, (item.cal / maxCal) * 100));
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${target}%`] });

  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={s.barHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.barName} numberOfLines={1}>{item.name}</Text>
          {/* the amount, in words, right under the name — so you can check the
              AI's assumption without opening anything */}
          <Text style={[s.barAmount, item.edited && { color: T.green }]} numberOfLines={1}>
            {item.amountLabel}{item.edited ? " · you set this" : ""}
          </Text>
        </View>
        <Text style={s.barCal}>{item.cal} cal</Text>
      </View>

      <View style={s.barTrack}>
        <Animated.View style={{ width, height: "100%" }}>
          <LinearGradient
            colors={[col.from, col.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.barFill}
          >
            <Text style={[s.barMacros, { color: col.text }]} numberOfLines={1}>
              Protein {item.p}g · Carbs {item.c}g · Fat {item.f}g
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/* ---------- the loading state ---------- */
function Analysing({ label }: { label: string }) {
  const { T } = useApp();
  const s = styles(T);
  return (
    <View style={s.centre}>
      <IsoMGlow size={92} />
      <Text style={s.centreText}>{label}</Text>
    </View>
  );
}

/* ---------- the voice refinement ---------- */
function Voice({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [state, setState] = useState<"idle" | "recording" | "paused" | "sending">("idle");
  const [secs, setSecs] = useState(0);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let id: any;
    if (state === "recording") id = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== "recording") { pulse.setValue(1); return; }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [state]);

  useEffect(() => {
    if (state === "sending") {
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state === "sending") return <Analysing label="Adding your notes to the estimate…" />;

  const mm = `0:${String(secs).padStart(2, "0")}`;

  return (
    <View style={s.voiceWrap}>
      {/* stays Lucide — this one needs to be GOLD for the Pro tag, and the
          animation is baked green */}
      <View style={s.proTag}>
        <Mic size={16} color={T.gold} />
        <Text style={s.proTagText}>PRO · MOTION VOICE AI</Text>
      </View>

      <View style={{ width: "100%", maxWidth: 320 }}>
        <View style={s.voiceCard}>
          {state === "paused" ? (
            <Text style={s.voiceBody}>Got it — add anything else, or send it to Motion.</Text>
          ) : (
            <>
              <Text style={s.voiceTitle}>Describe what you're eating</Text>
              <Text style={s.voiceBody}>
                The more detail you give, the more accurate your calories. Say what it is, how it was
                cooked, and roughly how much — including anything on the side.
              </Text>
              <View style={s.tipBox}>
                <Text style={s.tipEmoji}>💡</Text>
                <Text style={s.tipText}>
                  If it's packaged, read the label out loud — "Greek yogurt, 120 cal, 10g protein, 3g fat
                  per pot." The numbers help MOTION get it exactly right.
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={[s.timer, { opacity: state === "idle" ? 0.3 : 1 }]}>{mm}</Text>
        <Text style={[s.recLine, { color: state === "recording" ? T.green : T.micro }]}>
          {state === "recording"
            ? "● Recording — you can put your phone down"
            : state === "paused" ? "Paused" : "Tap the mic to start"}
        </Text>

        <View style={{ alignItems: "center" }}>
          <Pressable onPress={() => { H.tap(); setState(state === "recording" ? "paused" : "recording"); }}>
            <Animated.View
              style={[
                s.micBtn,
                state === "recording"
                  ? { backgroundColor: T.card, borderWidth: 2, borderColor: T.green, opacity: pulse }
                  : { backgroundColor: T.green },
              ]}
            >
              {state === "recording"
                ? <View style={s.stopSquare} />
                : <Icon name="micDark" size={32} mode="loop" />}
            </Animated.View>
          </Pressable>

          <Text style={s.micHint}>
            {state === "recording" ? "Tap to pause" : state === "paused" ? "Tap mic to add more" : "Tap to talk"}
          </Text>
        </View>

        {state === "paused" && (
          <Tap onPress={() => { H.success(); setState("sending"); }} style={{ marginTop: 22 }}>
            <View style={s.sendBtn}>
              <Send size={16} color={T.ink} />
              <Text style={s.sendText}>Done — send to Motion</Text>
            </View>
          </Tap>
        )}

        <Pressable onPress={onBack} style={{ marginTop: 14, alignItems: "center" }} hitSlop={10}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- logged ---------- */
function Done({ meal, onExit }: { meal: string; onExit: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [saved, setSaved] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={s.doneWrap}>
      <Animated.View style={[s.doneCircle, { transform: [{ scale: pop }] }]}>
        <Check size={38} color={T.green} />
      </Animated.View>

      <Text style={s.doneTitle}>Added to {meal}</Text>
      <Text style={s.doneSub}>Nice — that's logged and counted for today.</Text>

      <Tap
        onPress={() => { if (!saved) { H.success(); setSaved(true); } }}
        style={{ marginTop: 8, width: "100%", maxWidth: 260 }}
      >
        <View style={[s.saveMealBtn, saved && { backgroundColor: T.greenBg, borderColor: T.greenBorder }]}>
          {saved && <Check size={15} color={T.green} />}
          <Text style={[s.saveMealText, saved && { color: T.green }]}>
            {saved ? "Saved to your meals" : "Save as a meal"}
          </Text>
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

/* ================= the flow ================= */
export type ResultStage = "analysing" | "result" | "voice" | "improved" | "done";

export default function ResultFlow({
  meal, photoUri, noPhoto, stage, setStage, onExit, onRetake,
}: {
  meal: string;
  photoUri?: string | null;
  noPhoto?: boolean;
  stage: ResultStage;
  setStage: (s: ResultStage) => void;
  onExit: () => void;
  onRetake: () => void;
}) {
  const { T, freeLocked, userId, refreshStreak } = useApp();
  const s = styles(T);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [items, setItems] = useState<Item[]>(BASE);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  /* the save is a network call, so the button has to show it's working and
     has to be able to fail without losing the plate the user just corrected */
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "analysing") return;
    const t = setTimeout(() => setStage("result"), 1500);
    return () => clearTimeout(t);
  }, [stage]);

  /* the voice pass replaces the estimate wholesale — any edits made before it
     are superseded, because the user just described the meal properly */
  useEffect(() => {
    if (stage === "improved") setItems(IMPROVED);
  }, [stage]);

  if (stage === "analysing") {
    return <Analysing label={noPhoto ? "Estimating from your description…" : "Reading the plate…"} />;
  }

  if (stage === "voice") {
    return <Voice onBack={() => setStage("result")} onDone={() => setStage("improved")} />;
  }

  const improved = stage === "improved";
  const maxCal = Math.max(1, ...items.map((i) => i.cal));
  const total = items.reduce(
    (a, i) => ({ cal: a.cal + i.cal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const source = improved ? IMPROVED : BASE;
  const edited = items.some((i) => i.edited) || items.length !== source.length;
  const active = editing != null ? items[editing] : null;

  /* THE WRITE. Only reached once the user has seen the plate and agreed to it,
     which is why it lives on this button rather than firing after analysis —
     an estimate nobody confirmed isn't a meal. */
  const logMeal = async () => {
    if (saving) return;

    if (!items.length) {
      setSaveErr("There's nothing on the plate to log.");
      return;
    }
    if (!userId) {
      setSaveErr("You're signed out — sign in and try again.");
      return;
    }

    setSaveErr(null);
    setSaving(true);

    const { mealId, error } = await saveMeal(userId, {
      mealType: meal.toLowerCase() as any,
      source: noPhoto ? "manual" : improved ? "voice" : "photo",
      items: items.map((it) => ({
        foodName: it.name,
        amountLabel: it.amountLabel,
        grams: it.grams,
        calories: it.cal,
        protein: it.p,
        carbs: it.c,
        fat: it.f,
        /* whether these numbers came from the AI or from the user correcting
           it — worth keeping, so we can later measure how often the AI is
           wrong and by how much */
        source: it.edited ? "user" : improved ? "voice" : "ai",
      })),
    });

    if (error || !mealId) {
      /* stay on the plate. Bouncing to the success screen after a failed save
         would tell them it worked when it didn't, and they'd lose every
         correction they just made. */
      setSaving(false);
      setSaveErr(error || "Couldn't save that meal.");
      H.warn();
      return;
    }

    /* THE MEAL IS ALREADY SAVED. The photo goes up afterwards and is NOT
       awaited before showing success — a slow or failed upload must not cost
       the user their meal. Worst case they get a recap card without a picture,
       which is a far smaller loss than a save that appeared to fail.
       The upload needs the meal's id for its filename, which is why it can't
       happen any earlier. */
    if (photoUri) {
      uploadMealPhoto(userId, mealId, photoUri)
        .then(({ path }) => { if (path) setMealPhoto(mealId, path); })
        .catch(() => {});
    }

    /* today's first meal may have just extended the streak — recompute so the
       flame and tier are right by the time they're back on Home */
    refreshStreak();

    H.success();
    setSaving(false);
    setStage("done");
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

        {/* the shot */}
        <Tap onPress={() => { H.tap(); setPhotoMenu(true); }}>
          <View style={s.photo}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <LinearGradient colors={["#3A2E1E", "#2E2419"]} style={s.photoPlaceholder}>
                {noPhoto ? (
                  <>
                    <PenLine size={20} color="rgba(255,255,255,0.5)" />
                    <Text style={s.photoText}>No photo · estimated</Text>
                  </>
                ) : (
                  <>
                    <Camera size={20} color="rgba(255,255,255,0.5)" />
                    <Text style={s.photoText}>your meal photo</Text>
                  </>
                )}
              </LinearGradient>
            )}

            <View style={s.photoChip}>
              <Camera size={12} color="#FFFFFF" />
              <Text style={s.photoChipText}>Tap to change</Text>
            </View>
          </View>
        </Tap>

        <View style={s.estRow}>
          <Sparkles size={12} color={T.green} />
          <Text style={s.estText}>
            {edited ? "ADJUSTED BY YOU" : improved ? "UPDATED WITH YOUR DETAILS" : "MOTION AI ESTIMATE"}
          </Text>
        </View>
        <Text style={s.mealTitle}>Eggs, avocado & rice</Text>

        <View style={s.plateHead}>
          <Text style={s.micro}>On your plate · {items.length} items</Text>
          <Text style={s.plateHint}>Tap to change an amount</Text>
        </View>

        {items.map((it, i) => (
          <FoodBar
            key={`${it.name}-${i}`}
            item={it}
            maxCal={maxCal}
            onPress={() => { H.tap(); setEditing(i); }}
          />
        ))}

        {items.length === 0 && (
          <Text style={s.emptyPlate}>
            Nothing left on this plate — add something below, or retake the photo.
          </Text>
        )}

        {/* the AI misses things — drinks and side dishes especially. Without
            this, a free user who spots a missing item has no way to add it. */}
        <Tap onPress={() => { H.tap(); setAdding(true); }} style={{ marginBottom: 14 }}>
          <View style={s.addRow}>
            <View style={s.addIcon}>
              <Plus size={16} color={T.green} />
            </View>
            <Text style={s.addText}>Add an item MOTION missed</Text>
          </View>
        </Tap>

        {/* the total */}
        <View style={{ marginBottom: 14 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
            <View style={{ padding: 16 }}>
              <View style={s.totalRow}>
                <Text style={s.micro}>Meal total</Text>
                <Text style={s.totalCal}>
                  {total.cal.toLocaleString()} <Text style={s.totalUnit}>cal</Text>
                </Text>
              </View>

              <View style={s.macroTiles}>
                {[["Protein", total.p], ["Carbs", total.c], ["Fat", total.f]].map(([label, v]: any) => (
                  <View key={label} style={s.macroTile}>
                    <Text style={s.macroNum}>{v}g</Text>
                    <Text style={s.macroLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TravelBorder>
        </View>

        {/* the voice upsell — only before you've used it */}
        {!improved && (
          <Tap onPress={() => { H.tap(); setStage("voice"); }} style={{ marginBottom: 12 }}>
            <View style={s.voiceCallout}>
              <View style={s.voiceIcon}>
                {/* the DARK mic — this sits on a green fill, where the green
                    animation would disappear */}
                <Icon name="micDark" size={22} mode="loop" />
                {freeLocked && (
                  <View style={s.proCrown}>
                    <Crown size={9} color="#0A0A0A" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.calloutTitle}>Make it more accurate</Text>
                <Text style={s.calloutSub}>Tell us how you made it — 20 sec</Text>
              </View>
              <ChevronRight size={18} color={T.green} />
            </View>
          </Tap>
        )}

        {saveErr ? (
          <View style={s.errRow}>
            <AlertTriangle size={14} color={T.red} />
            <Text style={s.errText}>{saveErr}</Text>
          </View>
        ) : null}

        <Tap onPress={logMeal}>
          <View style={[s.logBtn, saving && { opacity: 0.6 }]}>
            <Text style={s.logBtnText}>
              {saving ? "Logging…" : `Log to ${meal}`}
            </Text>
          </View>
        </Tap>
      </ScrollView>

      {/* change an amount */}
      {active && (
        <AmountSheet
          visible
          name={active.name}
          currentGrams={active.grams}
          currentLabel={active.amountLabel}
          perGram={{
            cal: active.cal / active.grams,
            p: active.p / active.grams,
            c: active.c / active.grams,
            f: active.f / active.grams,
          }}
          onClose={() => setEditing(null)}
          onChange={(r) =>
            setItems((list) =>
              list.map((it, i) => (i === editing ? { ...it, ...r, edited: true } : it))
            )
          }
          onRemove={() => setItems((list) => list.filter((_, i) => i !== editing))}
        />
      )}

      {/* add something the AI missed */}
      <FoodPicker
        visible={adding}
        onClose={() => setAdding(false)}
        onPick={(f: PickedFood) => {
          setItems((list) => [
            ...list,
            {
              name: f.name,
              key: f.key,
              grams: f.grams,
              amountLabel: f.amountLabel,
              cal: f.cal,
              p: f.p,
              c: f.c,
              f: f.f,
              edited: true,
            },
          ]);
          setAdding(false);
        }}
      />

      {/* keep or retake */}
      <Modal visible={photoMenu} transparent animationType="slide" onRequestClose={() => setPhotoMenu(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setPhotoMenu(false)} />
          <View style={s.menuSheet}>
            <Text style={s.menuTitle}>Use this photo, or take it again?</Text>

            <Tap onPress={() => { setPhotoMenu(false); setTimeout(onRetake, 220); }} style={{ marginBottom: 8 }}>
              <View style={s.menuRow}>
                <Camera size={20} color={T.green} />
                <Text style={s.menuRowText}>Retake photo</Text>
              </View>
            </Tap>

            <Tap onPress={() => setPhotoMenu(false)}>
              <View style={[s.menuRow, { backgroundColor: T.greenBg, borderColor: T.greenBorder }]}>
                <Check size={20} color={T.green} />
                <Text style={s.menuRowText}>Keep this photo</Text>
              </View>
            </Tap>
          </View>
        </View>
      </Modal>

      {stage === "done" && <Done meal={meal} onExit={onExit} />}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, backgroundColor: T.bg },
    centreText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed, textAlign: "center" },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },

    photo: { height: 150, borderRadius: 16, overflow: "hidden", position: "relative", backgroundColor: "#2E2419" },
    photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
    photoText: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: FONTS.body },
    photoChip: {
      position: "absolute", right: 10, bottom: 10,
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 99,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    photoChipText: { fontSize: 10, color: "#FFFFFF", fontFamily: FONTS.headingMed },

    estRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 4 },
    estText: { fontSize: 10, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.body },
    mealTitle: { fontSize: 20, color: T.text, fontFamily: FONTS.heading, marginBottom: 16 },

    plateHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    plateHint: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },
    emptyPlate: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", paddingVertical: 22, lineHeight: 18 },

    barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7, gap: 10 },
    barName: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    barAmount: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    barCal: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed, marginTop: 1 },
    barTrack: { height: 28, borderRadius: 8, backgroundColor: T.track, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
    barFill: { flex: 1, borderRadius: 7, justifyContent: "center", paddingLeft: 11 },
    barMacros: { fontSize: 10, fontFamily: FONTS.headingMed },

    addRow: {
      flexDirection: "row", alignItems: "center", gap: 11,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
      borderStyle: "dashed",
    },
    addIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    addText: { fontSize: 13.5, color: T.green, fontFamily: FONTS.headingMed },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    totalCal: { fontSize: 26, color: T.text, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    macroTiles: { flexDirection: "row", gap: 8, marginTop: 12 },
    macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, paddingVertical: 9, alignItems: "center" },
    macroNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    macroLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },

    voiceCallout: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, padding: 14,
    },
    voiceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
    proCrown: {
      position: "absolute", top: -5, right: -5,
      width: 18, height: 18, borderRadius: 9, backgroundColor: T.gold,
      alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T.card,
    },
    calloutTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    calloutSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    logBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    logBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },

    /* voice */
    voiceWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: T.bg },
    proTag: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 18 },
    proTagText: { fontSize: 10, letterSpacing: 1.2, color: T.gold, fontFamily: FONTS.headingMed },
    voiceCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 16, padding: 16, marginBottom: 22 },
    voiceTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.heading, marginBottom: 8 },
    voiceBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 19 },
    tipBox: { flexDirection: "row", gap: 8, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    tipEmoji: { fontSize: 15 },
    tipText: { flex: 1, fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },
    timer: { fontSize: 30, color: T.text, fontFamily: FONTS.heading, textAlign: "center", marginBottom: 6 },
    recLine: { fontSize: 11, fontFamily: FONTS.body, textAlign: "center", marginBottom: 26 },
    micBtn: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
    stopSquare: { width: 24, height: 24, borderRadius: 6, backgroundColor: T.green },
    micHint: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 12 },
    sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: T.green, borderRadius: 14, paddingVertical: 14 },
    sendText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
    skip: { fontSize: 12, color: T.micro, fontFamily: FONTS.body },

    /* photo menu */
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    menuSheet: {
      marginTop: "auto", backgroundColor: T.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: T.border,
      paddingHorizontal: 18, paddingTop: 18, paddingBottom: 26,
    },
    menuTitle: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginBottom: 14 },
    menuRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 14,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
    },
    menuRowText: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },

    /* done */
    doneWrap: {
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
      backgroundColor: T.bg, alignItems: "center", justifyContent: "center",
      gap: 14, padding: 24,
    },
    doneCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    doneTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    doneSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center" },
    saveMealBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: 13, paddingVertical: 12,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
    },
    saveMealText: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    donePrimary: { backgroundColor: T.green, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    donePrimaryText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });