// components/Avatar.tsx
// The profile picture, with an optional camera badge that opens the photo
// sheet. Falls back to initials until a photo is set.
import { Camera } from "lucide-react-native";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import { FONTS } from "../constants/theme";

export function initialsOf(name?: string) {
  const source = (name || "").trim();
  if (!source) return "··";
  return source
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Avatar({
  size = 50,
  badge = false,
  accent,
  onPress,
}: {
  size?: number;
  badge?: boolean;
  accent?: string;
  onPress?: () => void;
}) {
  const { T, profile } = useApp();
  const color = accent || T.green;
  const badgeSize = size * 0.36;

  return (
    <View style={{ width: size, height: size }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <View
          style={[
            s.circle,
            { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: T.cardHi },
          ]}
        >
          {profile.photoUri ? (
            <Image
              source={{ uri: profile.photoUri }}
              style={{ width: size, height: size, borderRadius: size / 2 }}
            />
          ) : (
            <Text style={{ fontSize: size * 0.34, color, fontFamily: FONTS.heading }}>
              {initialsOf(profile.name)}
            </Text>
          )}
        </View>
      </Pressable>

      {badge && (
        <Pressable
          onPress={onPress}
          hitSlop={8}
          style={[
            s.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: T.green,
              borderColor: T.bg,
            },
          ]}
        >
          <Camera size={badgeSize * 0.55} color={T.ink} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  circle: { borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  badge: {
    position: "absolute", right: -2, bottom: -2,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
});