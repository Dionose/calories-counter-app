// app/index.tsx
// The app's launch route — sends you into onboarding first.
// Onboarding calls router.replace("/(tabs)") when done, so you won't loop back here.
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/onboarding" />;
}