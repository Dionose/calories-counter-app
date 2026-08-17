// components/PhotoSheet.tsx
// The profile-photo chooser. "Take a photo" will hand off to the in-app camera
// once that's built; for now both options are wired but inert.
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

export default function PhotoSheet({
  visible,
  onClose,
  onTakePhoto,
  onPickLibrary,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  onTakePhoto?: () => void;
  onPickLibrary?: () => void;
  onRemove?: () => void;
}) {
  const { T, profile } = useApp();
  const s = styles(T);

  const Option = ({ icon: Icon, label, sub, onPress, danger }: any) => (
    <Tap
      onPress={() => { H.tap(); onClose(); setTimeout(() => onPress?.(), 220); }}
      style={{ marginBottom: 10 }}
    >
      <View style={s.option}>
        <View style={[s.optionIcon, danger && { backgroundColor: "rgba(239,68,68,0.12)" }]}>
          <Icon size={18} color={danger ? T.red : T.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.optionLabel, danger && { color: T.red }]}>{label}</Text>
          <Text style={s.optionSub}>{sub}</Text>
        </View>
      </View>
    </Tap>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>Profile photo</Text>

          <Option icon={Camera} label="Take a photo" sub="Open the camera" onPress={onTakePhoto} />
          <Option icon={ImageIcon} label="Choose from library" sub="Pick an existing photo" onPress={onPickLibrary} />
          {profile.photoUri && (
            <Option icon={Trash2} label="Remove photo" sub="Go back to your initials" onPress={onRemove} danger />
          )}

          <Tap onPress={onClose} style={{ marginTop: 4 }}>
            <View style={s.cancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </View>
          </Tap>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      marginTop: "auto", backgroundColor: T.bg,
      borderTopWidth: 1, borderTopColor: T.border,
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30,
    },
    grabber: { width: 38, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginBottom: 16 },
    title: { fontSize: 15, color: T.text, fontFamily: FONTS.heading, marginBottom: 14, marginLeft: 2 },

    option: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15 },
    optionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    optionLabel: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    optionSub: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 1 },

    cancel: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    cancelText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });