// components/WeighInSheet.tsx
// Logging a weigh-in. Opens from Home's weight chip and from Stats.
//
// The whole screen is ONE number and one button. Weighing yourself is already
// the unpleasant part of the day for a lot of people — the app's job is to
// take the reading and get out of the way, not to make an event of it.
import { AlertTriangle, Check, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import { fromKg, saveWeighIn } from "../constants/weight";
import Tap from "./Tap";

export default function WeighInSheet({
  visible,
  onClose,
  onSaved,
  lastKg,
}: {
  visible: boolean;
  onClose: () => void;
  /** fired after a successful write, so the opener can refresh its chart */
  onSaved?: () => void;
  /** their most recent weigh-in, used as the placeholder */
  lastKg?: number | null;
}) {
  const { T, profile, userId } = useApp();
  const s = styles(T);

  const unit = profile.weightUnit || "kg";
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /* fresh every time it opens — a number left over from last week would be
     the easiest thing in the world to save by accident */
  useEffect(() => {
    if (visible) { setVal(""); setErr(null); setDone(false); setBusy(false); }
  }, [visible]);

  const n = parseFloat(val);
  const ok = !isNaN(n) && n > 0;

  /* what to show in the empty field. Their last weigh-in if there is one,
     otherwise their starting weight — either way it's a number they'd
     recognise, which makes a typo easier to spot. */
  const placeholder = lastKg
    ? fromKg(lastKg, unit).toFixed(1)
    : profile.startWeight
      ? String(profile.startWeight)
      : unit === "kg" ? "75" : "165";

  const save = async () => {
    if (!ok || busy) return;
    if (!userId) { setErr("You're signed out — sign in and try again."); return; }

    setErr(null);
    setBusy(true);

    const { error } = await saveWeighIn(userId, n, unit as "kg" | "lbs");

    if (error) {
      setBusy(false);
      setErr(error);
      H.warn();
      return;
    }

    H.success();
    setDone(true);
    onSaved?.();
    /* a beat on the confirmation before closing. Dismissing instantly makes a
       successful save feel like nothing happened. */
    setTimeout(onClose, 900);
  };

  /* how today's reading compares to their last one. Shown only as a fact —
     "0.4 kg down since Tuesday" — with no praise or concern attached, because
     a single day's change is mostly water and doesn't deserve either. */
  const delta = lastKg && ok ? n - fromKg(lastKg, unit) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.sheet}>
          {done ? (
            <View style={s.doneWrap}>
              <View style={s.doneCircle}>
                <Check size={30} color={T.green} />
              </View>
              <Text style={s.doneText}>Weight logged</Text>
            </View>
          ) : (
            <>
              <View style={s.head}>
                <View style={{ width: 34 }} />
                <Text style={s.title}>Log your weight</Text>
                <Pressable onPress={onClose} hitSlop={14} style={s.close}>
                  <X size={17} color={T.sub} />
                </Pressable>
              </View>

              <Text style={s.sub}>
                Weigh yourself at the same time each day if you can — first thing, before eating, is
                the most consistent.
              </Text>

              <View style={s.entryRow}>
                <TextInput
                  value={val}
                  onChangeText={(t) => { setVal(t.replace(/[^0-9.]/g, "")); setErr(null); }}
                  placeholder={placeholder}
                  placeholderTextColor={T.micro}
                  keyboardType="decimal-pad"
                  style={s.bigInput}
                  maxLength={5}
                  autoFocus
                  onSubmitEditing={save}
                />
                <Text style={s.unit}>{unit}</Text>
              </View>

              {/* stated flatly, with no verdict attached — a day's change is
                  mostly water, and praising or worrying about it would be
                  reading meaning into noise */}
              {delta !== null && Math.abs(delta) >= 0.1 && (
                <Text style={s.delta}>
                  {Math.abs(delta).toFixed(1)} {unit} {delta < 0 ? "down" : "up"} from your last weigh-in
                </Text>
              )}

              {err ? (
                <View style={s.errRow}>
                  <AlertTriangle size={14} color={T.red} />
                  <Text style={s.errText}>{err}</Text>
                </View>
              ) : null}

              <Tap onPress={save} style={{ marginTop: 22 }}>
                <View style={[s.saveBtn, (!ok || busy) && s.saveOff]}>
                  <Text style={[s.saveText, (!ok || busy) && { color: T.micro }]}>
                    {busy ? "Saving…" : "Save"}
                  </Text>
                </View>
              </Tap>

              {/* one entry per day, and a second REPLACES the first. Saying so
                  up front stops the "did it not save?" moment when someone
                  weighs in twice and sees one row. */}
              <Text style={s.note}>
                Logging again today updates this reading rather than adding a second one.
              </Text>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)" },

    sheet: {
      backgroundColor: T.bg,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      borderWidth: 1, borderBottomWidth: 0, borderColor: T.border,
      paddingHorizontal: 22, paddingTop: 16, paddingBottom: 34,
    },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    title: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },

    sub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18, marginBottom: 4 },

    entryRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginTop: 22 },
    bigInput: {
      fontSize: 56, color: T.text, fontFamily: FONTS.heading,
      minWidth: 150, padding: 0, textAlign: "center",
      borderBottomWidth: 2, borderBottomColor: T.greenBorder,
    },
    unit: { fontSize: 20, color: T.sub, fontFamily: FONTS.body, marginLeft: 10 },

    delta: { fontSize: 12, color: T.sub, fontFamily: FONTS.bodyMed, textAlign: "center", marginTop: 14 },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16,
      backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)", borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12.5, color: T.red, fontFamily: FONTS.body, lineHeight: 18 },

    saveBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    saveOff: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    saveText: { fontSize: 15, color: T.ink, fontFamily: FONTS.heading },

    note: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14, lineHeight: 15 },

    doneWrap: { alignItems: "center", paddingVertical: 34, gap: 14 },
    doneCircle: {
      width: 66, height: 66, borderRadius: 33,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    doneText: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
  });