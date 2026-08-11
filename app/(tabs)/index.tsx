// app/(tabs)/index.tsx
import { ChevronDown, Flame } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;

function Micro({ children }: { children: React.ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

export default function Home() {
  const [open, setOpen] = useState(false);

  const meals: [string, number][] = [
    ["Breakfast", 215],
    ["Lunch", 530],
    ["Dinner", 0],
    ["Snacks", 0],
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        {/* header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>TUESDAY · AUG 9</Text>
            <Text style={styles.greeting}>Good evening, Dion</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>DJ</Text>
          </View>
        </View>

        {/* HERO calorie widget */}
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <Pressable onPress={() => setOpen(!open)} style={{ padding: 20 }}>
            <View style={styles.rowBetween}>
              <Micro>Calories remaining</Micro>
              <ChevronDown
                size={16}
                color={T.micro}
                style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
              />
            </View>
            <View style={styles.calRow}>
              <Text style={styles.calBig}>1,235</Text>
              <Text style={styles.calSub}>of 1,980 cal</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: "38%" }]} />
            </View>

            {open && (
              <View style={{ marginTop: 18 }}>
                {[
                  { label: "Protein", v: 34, t: 120, c: T.green },
                  { label: "Carbs", v: 58, t: 230, c: T.carbs },
                  { label: "Fat", v: 18, t: 65, c: T.fat },
                ].map((m) => (
                  <View key={m.label} style={{ marginBottom: 11 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.macroLabel}>{m.label.toUpperCase()}</Text>
                      <Text style={styles.macroLabel}>{m.v}/{m.t}g</Text>
                    </View>
                    <View style={styles.macroTrack}>
                      <View
                        style={{
                          width: `${Math.min(100, (m.v / m.t) * 100)}%`,
                          height: "100%",
                          backgroundColor: m.c,
                          borderRadius: 7,
                          justifyContent: "center",
                          alignItems: "flex-end",
                          paddingRight: 7,
                          minWidth: 34,
                        }}
                      >
                        <Text style={styles.macroInside}>{m.v}g</Text>
                      </View>
                    </View>
                  </View>
                ))}
                <View style={styles.eatenRow}>
                  {[["Eaten today", "745"], ["Burned", "320"]].map(([l, v]) => (
                    <View key={l} style={{ alignItems: "center" }}>
                      <Text style={styles.eatenNum}>{v}</Text>
                      <Text style={styles.eatenLabel}>{l.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!open && <Text style={styles.tapHint}>Tap to expand</Text>}
          </Pressable>
        </TravelBorder>

        {/* momentum strip */}
        <View style={styles.strip}>
          <View style={{ flex: 1 }}>
            <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={14}>
              <View style={{ padding: 13 }}>
                <Micro>Expected weight</Micro>
                <View style={styles.wRow}>
                  <Text style={styles.wBig}>78.2</Text>
                  <Text style={styles.wUnit}>kg</Text>
                  <Text style={styles.wTrend}>↓ 0.8</Text>
                </View>
                <Text style={styles.wLbs}>172.4 lbs</Text>
              </View>
            </TravelBorder>
          </View>

          <View style={{ flex: 1 }}>
            <TravelBorder color={T.orange} cardBg={T.card} borderColor={T.border} radius={14}>
              <View style={{ padding: 13 }}>
                <Micro>Streak</Micro>
                <View style={styles.wRow}>
                  <Text style={styles.wBig}>14</Text>
                  <Text style={styles.wUnit}>days</Text>
                  <Flame size={16} color={T.orange} fill={T.orange} style={{ marginLeft: "auto" }} />
                </View>
                <Text style={[styles.wLbs, { color: T.orange }]}>Hot · keep going</Text>
              </View>
            </TravelBorder>
          </View>
        </View>

        {/* meals */}
        <Text style={[styles.micro, { marginBottom: 10 }]}>TODAY'S MEALS</Text>
        {meals.map(([name, total]) => (
          <Pressable key={name} style={styles.meal}>
            <Text style={styles.mealName}>{name}</Text>
            {total ? (
              <Text style={styles.mealCal}>{total} cal</Text>
            ) : (
              <View style={styles.addWrap}>
                <View style={styles.addBtn}>
                  <Text style={{ color: T.green, fontSize: 15 }}>+</Text>
                </View>
                <Text style={styles.addText}>Add {name.toLowerCase()}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  date: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body },
  greeting: { fontSize: 24, color: T.text, marginTop: 3, fontFamily: FONTS.heading },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  avatarText: { color: T.green, fontSize: 13, fontFamily: FONTS.headingMed },

  micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  calRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  calBig: { fontSize: 42, color: T.text, fontFamily: FONTS.heading },
  calSub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
  track: { marginTop: 14, height: 8, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: T.green, borderRadius: 99 },
  tapHint: { fontSize: 10, color: T.micro, marginTop: 10, textAlign: "center", fontFamily: FONTS.body },

  macroLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginBottom: 4 },
  macroTrack: { height: 20, borderRadius: 7, backgroundColor: T.track, overflow: "hidden" },
  macroInside: { fontSize: 11, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  eatenRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border },
  eatenNum: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
  eatenLabel: { fontSize: 9, color: T.micro, marginTop: 2, fontFamily: FONTS.body },

  strip: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 22 },
  wRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 },
  wBig: { fontSize: 20, color: T.text, fontFamily: FONTS.heading },
  wUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
  wTrend: { marginLeft: "auto", color: T.green, fontSize: 11, fontFamily: FONTS.headingMed },
  wLbs: { fontSize: 10.5, color: T.sub, marginTop: 2, fontFamily: FONTS.body },

  meal: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, marginBottom: 10, padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
  mealCal: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },
  addWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  addBtn: { width: 20, height: 20, borderRadius: 7, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
  addText: { color: T.sub, fontSize: 12, fontFamily: FONTS.body },
});