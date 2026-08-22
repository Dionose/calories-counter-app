// components/HandleField.tsx
// A username input that checks availability while you type.
//
// ⚠️ IT EXISTS BECAUSE THE SAME MISTAKE WAS ABOUT TO HAPPEN TWICE. There's a
// unique index on profiles.handle, and a collision makes Postgres reject the
// ENTIRE profile row — which is how two of Dion's accounts ended up with no
// profile at all. Onboarding now asks for a username, and Profile has always
// let you change one. Both need this check; neither should own it.
//
// CHECKED WHILE TYPING, NOT ON SUBMIT. Being told a name is taken after you've
// tapped the button is the same annoyance we removed from the email flow —
// you've already committed, and now you have to go back and undo. A tick
// beside the field as you type costs one query and answers the question before
// it's asked.
//
// DEBOUNCED at 450ms. Without it this is a database query per keystroke;
// with it, one per pause. 450 is long enough to catch a whole word and short
// enough that the answer feels immediate.
import { AlertTriangle, Check, Loader } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import { handleProblem, isHandleFree, suggestHandle } from "../constants/handles";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import AtSymbol from "./AtSymbol";

export type HandleState = "empty" | "checking" | "free" | "taken" | "invalid";

export default function HandleField({
  value,
  onChange,
  /** excluded from the "is it taken" check — someone editing their own
      username shouldn't be told their own handle is unavailable */
  exceptUserId,
  /** told whether the current value is safe to save. The parent uses this to
      enable or disable its own button. */
  onStateChange,
  placeholder = "yourname",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  exceptUserId?: string;
  onStateChange?: (state: HandleState) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [state, setState] = useState<HandleState>("empty");
  const [problem, setProblem] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  /* the pending check, so a new keystroke cancels the last one */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* which value the in-flight check is FOR. Without this, a slow reply for
     "dav" can land after "david" and stamp the wrong answer on the field. */
  const checking = useRef("");

  useEffect(() => { onStateChange?.(state); }, [state]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const h = value.trim().toLowerCase();
    setSuggestion(null);

    if (!h) {
      setState("empty");
      setProblem(null);
      return;
    }

    /* shape first, and locally — a two-letter handle doesn't need a round
       trip to be rejected */
    const shapeIssue = handleProblem(h);
    if (shapeIssue) {
      setState("invalid");
      setProblem(shapeIssue);
      return;
    }

    setProblem(null);
    setState("checking");
    checking.current = h;

    timer.current = setTimeout(async () => {
      const free = await isHandleFree(h, exceptUserId);

      /* they've typed more since this check started — throw it away */
      if (checking.current !== h) return;

      if (free) {
        setState("free");
        return;
      }

      setState("taken");

      /* OFFER A WAY OUT, don't just refuse. "david is taken" leaves them to
         invent something; "try david2" is one tap. */
      const alt = await suggestHandle(h, exceptUserId);
      if (checking.current === h) setSuggestion(alt);
    }, 450);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, exceptUserId]);

  return (
    <View>
      <View
        style={[
          s.box,
          state === "free" && { borderColor: T.greenBorder },
          (state === "taken" || state === "invalid") && { borderColor: "rgba(239,68,68,0.5)" },
        ]}
      >
        <AtSymbol size={18} />
        <TextInput
          value={value}
          /* FORCED LOWERCASE as they type, rather than corrected on save.
             @Dion and @dion being different people is a trap, and the
             leaderboard renders them identically. */
          onChangeText={(t) => onChange(t.toLowerCase().replace(/\s/g, ""))}
          placeholder={placeholder}
          placeholderTextColor={T.micro}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={s.input}
        />

        {/* the verdict, in the field itself */}
        {state === "checking" && <Loader size={16} color={T.micro} />}
        {state === "free" && <Check size={17} color={T.green} />}
        {(state === "taken" || state === "invalid") && <AlertTriangle size={16} color={T.red} />}
      </View>

      {state === "free" && (
        <Text style={s.ok}>@{value.trim().toLowerCase()} is available.</Text>
      )}

      {state === "invalid" && problem && <Text style={s.bad}>{problem}</Text>}

      {state === "taken" && (
        <View style={s.takenRow}>
          <Text style={s.bad}>@{value.trim().toLowerCase()} is already taken.</Text>

          {suggestion && (
            <Pressable
              onPress={() => { H.tap(); onChange(suggestion); }}
              style={s.suggestBtn}
              hitSlop={6}
            >
              <Text style={s.suggestText}>Use @{suggestion}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    box: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    },
    input: { flex: 1, color: T.text, fontFamily: FONTS.headingMed, fontSize: 14.5, padding: 0 },

    ok: { fontSize: 11.5, color: T.green, fontFamily: FONTS.body, marginTop: 6, marginLeft: 2 },
    bad: { fontSize: 11.5, color: T.red, fontFamily: FONTS.body, marginTop: 6, marginLeft: 2 },

    takenRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
    suggestBtn: {
      marginTop: 6,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5,
    },
    suggestText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed },
  });