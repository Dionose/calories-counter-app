// components/MealSheet.tsx
// One logged meal, opened.
//
// WHY IT EXISTS. A logged meal used to be a dead line of text — "Chicken
// breast, Pasta, Heavy cream, Butter" run together with commas, and that was
// everything you ever got. All the detail was sitting in the database: what
// each food weighed, what each one cost, the ingredients of any dish that was
// described out loud. None of it was reachable.
//
// AND IT'S WHERE A MISTAKE GETS FIXED. Log lunch twice and, before this, it
// was in your history permanently. For an app that asks people to trust its
// numbers, being unable to correct an obvious error is the worst kind of gap —
// it makes every other number look like something that happened TO you.
//
// USED FROM TWO PLACES, deliberately:
//   HOME     — where a mistake is made, thirty seconds after making it.
//   CALENDAR — where an older one is noticed, days later.
//
// NO "did you log twice?" WARNING ANYWHERE. The app can't reliably tell —
// people do eat two lunches — and being told you're wrong when you aren't is
// worse than being told nothing. Making the fix easy to find beats guessing.
//
// DELETING ASKS FIRST. It cannot be undone, and a photo of a meal eaten
// yesterday can't be taken again.
//
// ⚠️ LAYOUT: A ROW AND ITS INGREDIENTS ARE ONE CLIPPED BOX. They used to be
// two siblings with the ingredients pulled up by a negative margin so the
// seam looked joined — and with nothing clipping it, the panel could hang
// past the card and draw over the screen behind. It only showed on a
// PHOTOLESS meal: no photo means a shorter header, which means more content
// fits, which is what pushed the panel past the edge. Nesting them in one
// container with overflow hidden removes the negative margin entirely, and
// the card is now capped against the screen height so it can't outgrow it.
import { AlertTriangle, Mic, Trash2, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { deleteMeal, Meal, partsTotal } from "../constants/meals";
import { signedUrls } from "../constants/photos";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

const SCREEN_H = Dimensions.get("window").height;

/* the card never grows past this, whatever's in it. A meal with four items
   and a recipe inside one of them is a LOT of content, and the case that
   broke was exactly the tallest one. */
const CARD_MAX_H = Math.round(SCREEN_H * 0.84);

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

/* how the meal was logged, in words rather than a code */
const SOURCE_LABEL: Record<string, string> = {
  photo: "From a photo",
  voice: "Described out loud",
  barcode: "Scanned barcode",
  search: "Searched",
  manual: "Added by hand",
};

export default function MealSheet({
  visible, meal, goalCalories, onClose, onDeleted,
}: {
  visible: boolean;
  /** the meal as loadDay returns it — items, parts and all */
  meal: Meal | null;
  /** the day's calorie goal, so a meal can be shown as a share of it */
  goalCalories?: number;
  onClose: () => void;
  /** called after a successful delete, so the caller can refresh its list */
  onDeleted?: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [photo, setPhoto] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* THE PHOTO IS SIGNED HERE, not by the caller. The bucket is private, so a
     stored path can't be displayed on its own — each view mints a URL that
     expires. Doing it inside the sheet means both callers get pictures
     without either having to know that. */
  useEffect(() => {
    let cancelled = false;
    setPhoto(null);
    setConfirming(false);
    setErr(null);

    if (!visible || !meal?.photoUrl) return;

    (async () => {
      const map = await signedUrls([meal.photoUrl as string]);
      if (cancelled) return;
      setPhoto(map[meal.photoUrl as string] || null);
    })();

    return () => { cancelled = true; };
  }, [visible, meal?.id, meal?.photoUrl]);

  if (!meal) return null;

  const totals = meal.items.reduce(
    (t, i) => ({
      cal: t.cal + (i.calories || 0),
      p: t.p + (i.protein || 0),
      c: t.c + (i.carbs || 0),
      f: t.f + (i.fat || 0),
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const pct = goalCalories && goalCalories > 0
    ? Math.round((totals.cal / goalCalories) * 100)
    : null;

  const remove = async () => {
    if (deleting || !meal.id) return;

    setDeleting(true);
    setErr(null);

    const { error } = await deleteMeal(meal.id);

    setDeleting(false);

    if (error) {
      /* STAY OPEN. A delete that silently failed would leave the meal in their
         diary while the screen said it was gone — the same class of bug as the
         food that never saved. */
      setErr(error);
      H.warn();
      return;
    }

    H.success();
    onDeleted?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.centre} pointerEvents="box-none">
          {/* CAPPED AND CLIPPED. maxHeight keeps a long meal inside the screen;
              overflow hidden keeps everything inside the rounded corners. */}
          <View style={s.card}>
            {/* the photo, when there is one. A meal logged by barcode or by
                voice has none, and that's an ordinary state rather than a
                failure — so the header just closes up instead of showing an
                empty frame. */}
            {photo ? (
              <View style={s.photoWrap}>
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <Pressable onPress={onClose} hitSlop={12} style={s.closeOnPhoto}>
                  <X size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={s.plainHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.plainHeadLabel}>
                    {SLOT_LABEL[meal.mealType] || "Meal"}
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
                  <X size={17} color={T.sub} />
                </Pressable>
              </View>
            )}

            {/* flexShrink rather than a fixed maxHeight — the scroll area takes
                whatever the card has left after the header, on any phone */}
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: 18, paddingTop: photo ? 16 : 4 }}
              showsVerticalScrollIndicator={false}
            >
              {photo ? (
                <Text style={s.slotLabel}>{SLOT_LABEL[meal.mealType] || "Meal"}</Text>
              ) : null}

              {/* the total, and how it sat against the day */}
              <View style={s.totalRow}>
                <Text style={s.totalCal}>{totals.cal.toLocaleString()}</Text>
                <Text style={s.totalUnit}>calories</Text>
                {pct != null && <Text style={s.totalPct}>{pct}% of your day</Text>}
              </View>

              <View style={s.macroRow}>
                {[["Protein", totals.p], ["Carbs", totals.c], ["Fat", totals.f]].map(([k, v]: any) => (
                  <View key={k} style={s.macroTile}>
                    <Text style={s.macroNum}>{v}g</Text>
                    <Text style={s.macroKey}>{k}</Text>
                  </View>
                ))}
              </View>

              {meal.source ? (
                <View style={s.sourceRow}>
                  {meal.source === "voice" && <Mic size={11} color={T.green} />}
                  <Text style={s.sourceText}>
                    {SOURCE_LABEL[meal.source] || meal.source}
                  </Text>
                </View>
              ) : null}

              <Text style={s.itemsLabel}>
                {meal.items.length} {meal.items.length === 1 ? "item" : "items"}
              </Text>

              {/* EVERY FOOD, with its own numbers. This is what the comma-run
                  title was hiding. */}
              {meal.items.map((item, i) => {
                const hasParts = !!item.parts?.length;

                /* ONE BOX. The row and its ingredients share a container that
                   clips them — see the layout note at the top of the file. */
                return (
                  <View
                    key={item.id || i}
                    style={[s.itemBox, hasParts && s.itemBoxDish]}
                  >
                    <View style={s.itemRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {hasParts && (
                          <Text style={s.dishTag}>
                            {item.parts!.length} INGREDIENTS
                          </Text>
                        )}
                        <Text style={s.itemName} numberOfLines={2}>{item.foodName}</Text>
                        {(item.amountLabel || item.grams) ? (
                          <Text style={s.itemAmount}>
                            {item.amountLabel}
                            {item.grams ? ` · about ${item.grams} g` : ""}
                          </Text>
                        ) : null}
                        {(item.protein || item.carbs || item.fat) ? (
                          <Text style={s.itemMacros}>
                            P {item.protein ?? 0}g · C {item.carbs ?? 0}g · F {item.fat ?? 0}g
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.itemCal, hasParts && { color: T.gold }]}>
                          {item.calories}
                        </Text>
                        <Text style={s.itemCalUnit}>cal</Text>
                      </View>
                    </View>

                    {/* WHAT WENT INTO IT. Shown open rather than behind a hold:
                        on the logging screen the hold keeps a busy list tidy,
                        but here the whole point of opening the meal is to see
                        inside it. */}
                    {hasParts && (
                      <View style={s.partsWrap}>
                        {item.parts!.map((p, n) => (
                          <View
                            key={n}
                            style={[
                              s.partRow,
                              /* no rule under the last one — it would sit
                                 against the footer line and read as a gap */
                              n === item.parts!.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.partName} numberOfLines={1}>{p.name}</Text>
                              {p.amountLabel ? (
                                <Text style={s.partAmount} numberOfLines={1}>{p.amountLabel}</Text>
                              ) : null}
                            </View>
                            <Text style={s.partCal}>{p.calories} cal</Text>
                          </View>
                        ))}
                        <Text style={s.partsFoot}>
                          These add up to {Math.round(partsTotal(item.parts).calories)} cal
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {err ? (
                <View style={s.errRow}>
                  <AlertTriangle size={14} color={T.red} />
                  <Text style={s.errText}>Couldn't delete that meal: {err}</Text>
                </View>
              ) : null}

              {/* ---------- DELETING ----------
                  Two taps, always. This can't be undone, and a photo of
                  yesterday's dinner can't be taken again. */}
              {confirming ? (
                <View style={s.confirmWrap}>
                  <Text style={s.confirmTitle}>Delete this meal?</Text>
                  <Text style={s.confirmBody}>
                    It comes off your day's total and out of your history for good. If it was the
                    only thing logged that day, the day stops counting towards your streak.
                  </Text>

                  <View style={s.confirmBtns}>
                    <Tap onPress={() => { H.tick(); setConfirming(false); }} style={{ flex: 1 }}>
                      <View style={s.keepBtn}>
                        <Text style={s.keepBtnText}>Keep it</Text>
                      </View>
                    </Tap>

                    <Tap onPress={remove} style={{ flex: 1 }}>
                      <View style={[s.deleteBtn, deleting && { opacity: 0.6 }]}>
                        {deleting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Trash2 size={14} color="#fff" />
                            <Text style={s.deleteBtnText}>Delete</Text>
                          </>
                        )}
                      </View>
                    </Tap>
                  </View>
                </View>
              ) : (
                <Tap onPress={() => { H.warn(); setConfirming(true); }} style={{ marginTop: 16 }}>
                  <View style={s.removeRow}>
                    <Trash2 size={14} color={T.red} />
                    <Text style={s.removeText}>Delete this meal</Text>
                  </View>
                </Tap>
              )}

              <Tap onPress={onClose} style={{ marginTop: 10 }}>
                <View style={s.doneBtn}>
                  <Text style={s.doneBtnText}>Close</Text>
                </View>
              </Tap>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    card: {
      width: "100%", maxWidth: 380,
      /* the two lines that stop a tall meal escaping the screen */
      maxHeight: CARD_MAX_H,
      overflow: "hidden",
      backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
      borderRadius: 22,
    },

    photoWrap: { height: 170, backgroundColor: "#1A1613", position: "relative" },
    closeOnPhoto: {
      position: "absolute", top: 12, right: 12,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },

    plainHead: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4,
    },
    plainHeadLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    closeBtn: {
      width: 32, height: 32, alignItems: "center", justifyContent: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10,
    },

    slotLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    totalRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
    totalCal: { fontSize: 36, color: T.text, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    totalPct: { marginLeft: "auto", fontSize: 11, color: T.sub, fontFamily: FONTS.body },

    macroRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    macroTile: {
      flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 12, paddingVertical: 10, alignItems: "center",
    },
    macroNum: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    macroKey: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

    sourceRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
    sourceText: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body },

    itemsLabel: {
      fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body,
      textTransform: "uppercase", marginTop: 18, marginBottom: 10,
    },

    /* ONE BOX PER FOOD — the row and any ingredients live inside it, and
       overflow hidden means neither can escape its rounded corners */
    itemBox: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, overflow: "hidden", marginBottom: 9,
    },
    /* a described dish keeps the gold it wore when it was logged, so a curry
       looks like the same thing wherever you meet it */
    itemBoxDish: { borderColor: `${T.gold}55` },

    itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
    dishTag: { fontSize: 8, letterSpacing: 0.8, color: T.gold, fontFamily: FONTS.headingMed, marginBottom: 4 },
    itemName: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    itemAmount: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    itemMacros: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 4 },
    itemCal: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    itemCalUnit: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },

    /* no negative margins, no border radius of its own — it's inside the box
       already, and a divider is enough to separate it from the row */
    partsWrap: {
      backgroundColor: T.cardHi,
      borderTopWidth: 1, borderTopColor: `${T.gold}33`,
      paddingHorizontal: 13, paddingTop: 8, paddingBottom: 11,
    },
    partRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 7,
      borderBottomWidth: 1, borderBottomColor: T.border,
    },
    partName: { fontSize: 12.5, color: T.text, fontFamily: FONTS.body },
    partAmount: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },
    partCal: { fontSize: 12.5, color: T.gold, fontFamily: FONTS.headingMed },
    partsFoot: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, marginTop: 9 },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12, color: T.red, fontFamily: FONTS.body, lineHeight: 17 },

    removeRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.card, borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
      borderRadius: 13, paddingVertical: 13,
    },
    removeText: { fontSize: 13, color: T.red, fontFamily: FONTS.headingMed },

    confirmWrap: {
      marginTop: 16,
      backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 15, padding: 15,
    },
    confirmTitle: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    confirmBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18, marginTop: 6 },
    confirmBtns: { flexDirection: "row", gap: 9, marginTop: 14 },
    keepBtn: {
      alignItems: "center", justifyContent: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 12, paddingVertical: 12,
    },
    keepBtnText: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
      backgroundColor: T.red, borderRadius: 12, paddingVertical: 12,
    },
    deleteBtnText: { fontSize: 13, color: "#fff", fontFamily: FONTS.headingMed },

    doneBtn: {
      alignItems: "center", backgroundColor: T.card,
      borderWidth: 1, borderColor: T.border,
      borderRadius: 13, paddingVertical: 13,
    },
    doneBtnText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });