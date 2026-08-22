// components/Avatar.tsx
// The profile picture, with an optional camera badge that opens the photo
// sheet. Falls back to initials until a photo is set.
//
// ⚠️ IT RENDERS photoUrl, NOT profile.photoUri. Those are different things and
// mixing them up shows nothing at all:
//
//   profile.photoUri is a BUCKET PATH — "<user-id>/avatar.jpg". Handing that
//     to <Image> fails silently: no error, no broken-image icon, just an empty
//     circle where a face should be.
//   photoUrl is the signed, displayable URL that AppState mints from it.
//
// The signing lives in AppState rather than here because this component
// appears in five places at once — Home's header, the Profile card, the
// account screen — and five copies each signing the same file on every render
// would be absurd.
import { Camera } from "lucide-react-native";
import React, { useEffect, useState } from "react";
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
  const { T, profile, photoUrl } = useApp();
  const color = accent || T.green;
  const badgeSize = size * 0.36;

  /* ---------- WHEN THE IMAGE WON'T LOAD ----------
     A signed URL can expire, a file can be deleted from the bucket, or the
     phone can be offline. <Image> fails silently in all three cases, leaving
     an empty circle that looks like a rendering fault.

     Falling back to initials means a missing photo looks like NO photo, which
     is a state the user understands, rather than a hole in the screen. */
  const [failed, setFailed] = useState(false);

  /* a new photo deserves a fresh attempt — otherwise one failure would leave
     initials showing forever, even after they replace the picture */
  useEffect(() => { setFailed(false); }, [photoUrl]);

  const showPhoto = !!photoUrl && !failed;

  return (
    <View style={{ width: size, height: size }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <View
          style={[
            s.circle,
            { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: T.cardHi },
          ]}
        >
          {showPhoto ? (
            <Image
              source={{ uri: photoUrl! }}
              style={{ width: size, height: size, borderRadius: size / 2 }}
              onError={() => setFailed(true)}
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