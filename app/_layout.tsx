// app/_layout.tsx
import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, useFonts } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { View } from "react-native";
import Paywall from "../components/Paywall";
import { AppStateProvider } from "../constants/AppState";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#0A0A0A" }} />;
  }

  return (
    <AppStateProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0A" } }}>
        {/* onboarding shows first; it router.replace()s into (tabs) when done */}
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {/* the one paywall, available to every screen via openPaywall() */}
      <Paywall />
    </AppStateProvider>
  );
}