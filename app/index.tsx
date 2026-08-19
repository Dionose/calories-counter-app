// app/index.tsx
// The entry point. Decides where a launch lands, and it's the only file that
// makes that decision — every other screen assumes it already happened.
//
// Three outcomes:
//   signed in, has a plan   → the app
//   signed in, no plan yet  → onboarding (they abandoned it partway)
//   not signed in           → sign-in
//
// It waits for AppState's first load rather than guessing. Guessing means
// showing onboarding to someone with an account for a frame before yanking
// them away, which reads as a bug.
import { Redirect } from "expo-router";
import React from "react";
import { View } from "react-native";
import { IsoMGlow } from "../components/IsoM";
import { useApp } from "../constants/AppState";
import { DARK } from "../constants/theme";

export default function Index() {
  const { loading, userId, plan } = useApp();

  /* The splash. Brief — usually a few hundred milliseconds — but it has to
     exist, or the first render happens before we know who's signed in.
     DARK rather than the theme: the user's theme preference lives in the
     profile we haven't loaded yet, so there's nothing to read. */
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK.bg, alignItems: "center", justifyContent: "center" }}>
        <IsoMGlow size={112} />
      </View>
    );
  }

  if (!userId) return <Redirect href="/signin" />;

  /* An account with no calorie target means they signed up and quit before
     finishing. Send them back to complete it rather than into an app with no
     plan behind it. */
  if (!plan?.calories) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)" />;
}