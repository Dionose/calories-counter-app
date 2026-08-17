// components/MealPicker.tsx
// Which meal am I logging? Opened from the hub title, because the meal you're
// adding to is the one thing that must be obvious before you shoot.
import { Check, Coffee, Cookie, Moon, Sun, X } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

export const MEALS = [
  { key: "Breakfast", icon: Coffee, desc: "Your first meal of the day" },
  { key: "Lunch", icon: Sun, desc: "Midday" },
  { key: "Dinner", icon: Moon, desc: "Evening meal" },
  { key: "Snacks", icon: Cookie, desc: "Anything in between" },
];

export default function MealPicker({
  visible, meal, onPick, onClose,
}: {
  visible: boolean;
  meal: string;
  onPick: (m: string) => void;
  onClose: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Which meal?</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.close}>
              <X size={15} color={T.sub} />
            </Pressable>
          </View>

          {MEALS.map((m) => {
            const on = m.key === meal;
            const Icon = m.icon;
            return (
              <Tap key={m.key} onPress={() => { H.tick(); onPick(m.key); }} style={{ marginBottom: 8 }}>
                <View style={[s.row, on && { backgroundColor: T.greenBg, borderColor: T.greenBorder }]}>
                  <View style={[s.icon, { backgroundColor: on ? T.green : T.card }]}>
                    <Icon size={18} color={on ? T.ink : T.sub} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{m.key}</Text>
                    <Text style={s.rowDesc}>{m.desc}</Text>
                  </View>
                  {on && <Check size={18} color={T.green} />}
                </View>
              </Tap>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      marginTop: "auto", backgroundColor: T.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: T.border,
      paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    close: { padding: 6, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 9 },

    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 13, borderRadius: 14,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
    },
    icon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    rowName: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed },
    rowDesc: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  });