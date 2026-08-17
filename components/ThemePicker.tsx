// components/ThemePicker.tsx
// The Appearance sheet. Shows both themes as small previews rather than a list
// of words — you pick a look, so you should see the look.
import { Check, Moon, Sun } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { DARK, FONTS, LIGHT } from "../constants/theme";
import Tap from "./Tap";

export default function ThemePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { T, themeMode, setThemeMode } = useApp();
  const s = styles(T);

  const pick = (m: "dark" | "light") => {
    H.tap();
    setThemeMode(m);
  };

  const Swatch = ({ mode, theme, icon: Icon, label }: any) => {
    const on = themeMode === mode;
    return (
      <Tap onPress={() => pick(mode)} style={{ flex: 1 }}>
        <View style={[s.swatch, on && { borderColor: T.green, borderWidth: 2 }]}>
          {/* a miniature of the app in that theme */}
          <View style={[s.preview, { backgroundColor: theme.bg }]}>
            <View style={[s.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[s.previewBar, { backgroundColor: theme.green, width: "62%" }]} />
              <View style={[s.previewBar, { backgroundColor: theme.border, width: "38%", marginTop: 4 }]} />
            </View>
            <View style={[s.previewCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 5 }]}>
              <View style={[s.previewBar, { backgroundColor: theme.border, width: "80%" }]} />
            </View>
          </View>

          <View style={s.swatchFoot}>
            <Icon size={13} color={on ? T.green : T.sub} />
            <Text style={[s.swatchLabel, on && { color: T.green }]}>{label}</Text>
            {on && <Check size={14} color={T.green} style={{ marginLeft: "auto" }} />}
          </View>
        </View>
      </Tap>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.centre} pointerEvents="box-none">
          <View style={s.card}>
            <Text style={s.title}>Appearance</Text>
            <Text style={s.sub}>Applies everywhere in MOTION, right away.</Text>

            <View style={s.row}>
              <Swatch mode="dark" theme={DARK} icon={Moon} label="Dark" />
              <Swatch mode="light" theme={LIGHT} icon={Sun} label="Light" />
            </View>

            <Tap onPress={onClose} style={{ marginTop: 16 }}>
              <View style={s.done}>
                <Text style={s.doneText}>Done</Text>
              </View>
            </Tap>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
    card: { width: "100%", maxWidth: 350, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 22, padding: 20 },
    title: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    sub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
    row: { flexDirection: "row", gap: 10, marginTop: 16 },

    swatch: { borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },
    preview: { height: 84, padding: 9, justifyContent: "center" },
    previewCard: { borderRadius: 6, borderWidth: 1, padding: 6 },
    previewBar: { height: 4, borderRadius: 2 },
    swatchFoot: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: T.cardHi },
    swatchLabel: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },

    done: { alignItems: "center", paddingVertical: 12, borderRadius: 13, backgroundColor: T.green },
    doneText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });