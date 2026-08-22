// components/DietScreen.tsx
// "Do you follow a specific diet?" — moved here from onboarding.
//
// WHY IT MOVED. It was one of twenty-eight onboarding screens, and when that
// was cut to fifteen this was among the first to go: NOTHING IN THE APP READS
// profile.diet yet, so asking during signup bought a screen and spent nothing.
//
// It moves rather than dies because the artwork is real and took real time —
// five hand-built icon components plus three Lottie files, and a deliberate
// choice about which vegetable goes where. Here it costs nobody anything: only
// people who go looking for it ever see it.
//
// ⚠️ AND IT STILL DOESN'T DO ANYTHING YET. Saving works, the value persists,
// and no other screen consults it. That's an honest gap rather than a hidden
// one — the note at the bottom of the screen says so, because a setting that
// silently changes nothing is worse than one that admits it's waiting.
import { Check } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import AppleFruit from "./AppleFruit";
import BackRow from "./BackRow";
import BroccoliIcon from "./BroccoliIcon";
import CutleryIcon from "./CutleryIcon";
import EggIcon from "./EggIcon";
import Icon, { IconName } from "./Icon";
import SaveBtn from "./SaveBtn";
import SteakIcon from "./SteakIcon";
import Tap from "./Tap";

/* Every option carries real artwork — no generic bullets.

   BROCCOLI FOR VEGETARIAN rather than a second carrot: vegan already has one,
   and two carrots in one list is a coin-flip for the user rather than a
   choice. That reasoning came from the original screen and is worth keeping.

   Some are Lottie (`icon`), some are hand-built components (`custom`) — the
   ones nobody had a good animation for got drawn instead. */
type DietOption = {
  key: string;
  label: string;
  sub: string;
  icon?: IconName;
  custom?: any;
};

const DIETS: DietOption[] = [
  { key: "none", label: "No specific diet", sub: "Everything's on the table", custom: CutleryIcon },
  { key: "balanced", label: "Balanced", sub: "A bit of everything, nothing cut out", icon: "dietSalad" },
  { key: "wholefood", label: "Wholefood", sub: "Mostly unprocessed, cooked from scratch", custom: AppleFruit },
  { key: "lowcarb", label: "Low carb", sub: "Less bread, rice and pasta", custom: SteakIcon },
  { key: "keto", label: "Keto", sub: "Very low carb, high fat", custom: EggIcon },
  { key: "vegetarian", label: "Vegetarian", sub: "No meat or fish", custom: BroccoliIcon },
  { key: "vegan", label: "Vegan", sub: "No animal products at all", icon: "dietVegan" },
  { key: "pescatarian", label: "Pescatarian", sub: "Fish, but no other meat", icon: "dietFish" },
];

export default function DietScreen({ onBack }: { onBack: () => void }) {
  const { T, profile, updateProfile } = useApp();
  const s = styles(T);

  /* seeded from what's saved, so reopening shows their answer rather than
     starting blank — the same reason the Goal flow reads profile.activity */
  const [sel, setSel] = useState(profile.diet || "none");
  const [saved, setSaved] = useState(false);

  const changed = sel !== (profile.diet || "none");

  const save = () => {
    H.success();
    setSaved(true);
    updateProfile({ diet: sel });
    setTimeout(onBack, 750);
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Diet" onBack={onBack} />

      <Text style={s.note}>
        If you eat a particular way, MOTION can keep it in mind. Nothing here changes your calorie
        target — it's about what gets suggested to you, not how much.
      </Text>

      <View style={{ gap: 10, marginTop: 20 }}>
        {DIETS.map((d) => {
          const on = sel === d.key;
          const Custom = d.custom;

          return (
            <Tap key={d.key} onPress={() => { H.tap(); setSel(d.key); }}>
              <View style={[s.row, on && s.rowOn]}>
                <View style={s.rowIcon}>
                  {Custom
                    ? <Custom size={24} />
                    : <Icon name={d.icon!} size={24} mode="loop" />}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.label, on && { color: T.green }]}>{d.label}</Text>
                  <Text style={s.sub}>{d.sub}</Text>
                </View>

                {on && <Check size={18} color={T.green} />}
              </View>
            </Tap>
          );
        })}
      </View>

      <SaveBtn saved={saved} disabled={!changed} onPress={save} />

      {/* ⚠️ SAYING SO OUT LOUD. Nothing reads profile.diet yet — the value
          saves and sits there. A setting that quietly does nothing makes
          someone wonder whether the rest of the app is real too; a setting
          that says it's coming is just a setting that's coming. */}
      <Text style={s.foot}>
        MOTION doesn't use this yet — it's here so your answer is ready when food suggestions
        arrive. It never affects your calories or macros.
      </Text>
    </ScrollView>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    page: { padding: 16, paddingTop: 56, paddingBottom: 40 },
    note: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },

    row: {
      flexDirection: "row", alignItems: "center", gap: 13,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15,
    },
    rowOn: { borderColor: T.green, backgroundColor: T.greenBg },
    rowIcon: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center",
    },
    label: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    sub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    foot: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 16, lineHeight: 16 },
  });