// components/NoPhotoFlow.tsx
// Build a meal by searching for each thing you ate. Serves two entry points:
//
//   "Log without a photo" — I ate something and forgot to snap it. Opens on an
//   empty plate with an explanation, because the user may not know what to do.
//
//   "Search food"         — I know exactly what this was. Opens straight into
//   the picker, because making them tap "search" first is a wasted step.
//
// Same builder either way; only the framing and the first screen differ.
import { LinearGradient } from "expo-linear-gradient";
import { Check, Mic, Plus, Search, Sparkles, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { colorFor } from "../constants/foodColors";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import AmountSheet from "./AmountSheet";
import FoodPicker, { PickedFood } from "./FoodPicker";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

type Item = {
  name: string;
  key: string;
  grams: number;
  amountLabel: string;
  cal: number;
  p: number;
  c: number;
  f: number;
};

/* ---------- one bar on the running plate ---------- */
function Bar({ item, maxCal, onPress }: { item: Item; maxCal: number; onPress: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const col = colorFor(item.key);

  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, []);

  const target = Math.max(58, Math.min(100, (item.cal / maxCal) * 100));
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${target}%`] });

  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={s.barHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.barName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.barAmount} numberOfLines={1}>{item.amountLabel}</Text>
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

/* ---------- logged ---------- */
function Done({
  meal, items, total, searchMode, onExit,
}: {
  meal: string;
  items: Item[];
  total: number;
  searchMode?: boolean;
  onExit: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={s.doneWrap}>
      <Animated.View style={[s.doneCircle, { transform: [{ scale: pop }] }]}>
        <Check size={38} color={T.green} />
      </Animated.View>

      <Text style={s.doneTitle}>Logged to {meal}</Text>
      <Text style={s.doneSub}>
        {items.length} item{items.length !== 1 ? "s" : ""} · {total.toLocaleString()} cal
        {searchMode ? " — from the food database." : " — estimated without a photo."}
      </Text>

      <Tap onPress={onExit} style={{ marginTop: 10, width: "100%", maxWidth: 260 }}>
        <View style={s.donePrimary}>
          <Text style={s.donePrimaryText}>Done</Text>
        </View>
      </Tap>
    </View>
  );
}

/* ================= the flow ================= */
export default function NoPhotoFlow({
  meal, onExit, onVoice, searchMode, autoOpen,
}: {
  meal: string;
  onExit: () => void;
  onVoice: () => void;
  /** "Search food" rather than "log without a photo" — changes the framing */
  searchMode?: boolean;
  /** open the picker straight away, skipping the empty plate */
  autoOpen?: boolean;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [items, setItems] = useState<Item[]>([]);
  const [picking, setPicking] = useState(!!autoOpen);
  const [editing, setEditing] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const total = items.reduce((a, i) => a + i.cal, 0);
  const maxCal = Math.max(1, ...items.map((i) => i.cal));
  const active = editing != null ? items[editing] : null;

  /* opened straight into search and then backed out without picking anything —
     there's nothing to build on, so leave rather than showing an empty screen
     they didn't ask for */
  const closePicker = () => {
    setPicking(false);
    if (autoOpen && items.length === 0) onExit();
  };

  if (done) {
    return <Done meal={meal} items={items} total={total} searchMode={searchMode} onExit={onExit} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 30 }}>
        <View style={s.head}>
          <Pressable onPress={onExit} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
            <X size={22} color={T.text} />
          </Pressable>
          <Text style={s.micro}>
            Log {meal.toLowerCase()}{searchMode ? "" : " · no photo"}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <Text style={s.lead}>
          {searchMode
            ? "Find each food and set how much you had — exact numbers from the database."
            : "Add each thing you ate and MOTION works out the calories. No photo needed."}
        </Text>

        {/* the way in — opens the same picker the result screen uses */}
        <Tap onPress={() => { H.tap(); setPicking(true); }} style={{ marginBottom: 20 }}>
          <View style={s.searchCta}>
            <Search size={17} color={T.green} />
            <Text style={s.searchCtaText}>
              {items.length ? "Add another food" : "Search a food to add"}
            </Text>
            <Plus size={17} color={T.green} />
          </View>
        </Tap>

        {items.length > 0 ? (
          <>
            <View style={s.plateHead}>
              <Text style={s.micro}>Your meal · {items.length} item{items.length !== 1 ? "s" : ""}</Text>
              <Text style={s.plateHint}>Tap to change an amount</Text>
            </View>

            {items.map((it, i) => (
              <Bar
                key={`${it.name}-${i}`}
                item={it}
                maxCal={maxCal}
                onPress={() => { H.tap(); setEditing(i); }}
              />
            ))}

            <View style={{ marginTop: 4, marginBottom: 14 }}>
              <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
                <View style={s.totalCard}>
                  <Text style={s.micro}>Total</Text>
                  <Text style={s.totalCal}>
                    {total.toLocaleString()} <Text style={s.totalUnit}>cal</Text>
                  </Text>
                </View>
              </TravelBorder>
            </View>
          </>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyText}>
              Nothing added yet. Search above to start building your meal — add as many items as you
              like.
            </Text>
          </View>
        )}

        {/* the voice route — often faster than adding six things by hand */}
        <Tap onPress={() => { H.tap(); onVoice(); }} style={{ marginTop: 6 }}>
          <View style={s.voiceCallout}>
            <View style={s.voiceIcon}>
              <Mic size={19} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.calloutTitle}>Or just describe it out loud</Text>
              <Text style={s.calloutSub}>Faster than adding each item — say what you ate</Text>
            </View>
            <Sparkles size={16} color={T.green} />
          </View>
        </Tap>

        <Tap
          onPress={() => { if (items.length) { H.success(); setDone(true); } }}
          style={{ marginTop: 16 }}
        >
          <View style={[s.logBtn, !items.length && s.logBtnOff]}>
            <Text style={[s.logBtnText, !items.length && { color: T.micro }]}>
              {items.length ? `Log meal · ${total.toLocaleString()} cal` : "Add something first"}
            </Text>
          </View>
        </Tap>
      </ScrollView>

      {/* add a food */}
      <FoodPicker
        visible={picking}
        title={searchMode ? "Search food" : "What did you eat?"}
        onClose={closePicker}
        onPick={(f: PickedFood) => {
          setItems((list) => [
            ...list,
            {
              name: f.name, key: f.key, grams: f.grams, amountLabel: f.amountLabel,
              cal: f.cal, p: f.p, c: f.c, f: f.f,
            },
          ]);
          setPicking(false);
        }}
      />

      {/* change one you already added */}
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
            setItems((list) => list.map((it, i) => (i === editing ? { ...it, ...r } : it)))
          }
          onRemove={() => setItems((list) => list.filter((_, i) => i !== editing))}
        />
      )}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },

    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    lead: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18, marginBottom: 20 },

    searchCta: {
      flexDirection: "row", alignItems: "center", gap: 11,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 15, paddingVertical: 15, paddingHorizontal: 16,
    },
    searchCtaText: { flex: 1, fontSize: 14.5, color: T.green, fontFamily: FONTS.headingMed },

    plateHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    plateHint: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },

    barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7, gap: 10 },
    barName: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    barAmount: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    barCal: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed, marginTop: 1 },
    barTrack: { height: 28, borderRadius: 8, backgroundColor: T.track, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
    barFill: { flex: 1, borderRadius: 7, justifyContent: "center", paddingLeft: 11 },
    barMacros: { fontSize: 10, fontFamily: FONTS.headingMed },

    totalCard: { padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    totalCal: { fontSize: 24, color: T.text, fontFamily: FONTS.heading },
    totalUnit: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },

    empty: {
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderStyle: "dashed",
      borderRadius: 16, paddingVertical: 26, paddingHorizontal: 20,
    },
    emptyText: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19 },

    voiceCallout: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, padding: 14,
    },
    voiceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    calloutTitle: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    calloutSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    logBtn: { backgroundColor: T.green, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    logBtnOff: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    logBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },

    doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, backgroundColor: T.bg },
    doneCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    doneTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    doneSub: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18 },
    donePrimary: { backgroundColor: T.green, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    donePrimaryText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });