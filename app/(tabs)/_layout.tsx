// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import LottieView from "lottie-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "../../constants/AppState";
import { FONTS } from "../../constants/theme";

// ---- animated tab icons ----
const ICONS = {
  home: require("../../assets/motion-home-22C55E.json"),
  calendar: require("../../assets/motion-calendar-outline-green.json"),
  cameraDark: require("../../assets/motion-camera-dark.json"), // dark = shows on the green button
  stats: require("../../assets/motion-stats-hybrid-green.json"),
  profile: require("../../assets/motion-profile-22C55E.json"),
};

// A tab icon that always loops. Dimmed when the tab is not focused.
function TabLottie({ source, focused, size = 28 }: { source: any; focused: boolean; size?: number }) {
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      style={{ width: size, height: size, opacity: focused ? 1 : 0.55 }}
    />
  );
}

// the raised center camera button (dark icon on the green button)
function CameraTabIcon({ T }: { T: any }) {
  const s = styles(T);
  return (
    <View style={s.cameraWrap}>
      <View style={s.cameraButton}>
        <LottieView
          source={ICONS.cameraDark}
          autoPlay
          loop
          style={{ width: 30, height: 30 }}
        />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { T } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: T.green,
        tabBarInactiveTintColor: T.micro,
        tabBarStyle: {
          backgroundColor: T.card,
          borderTopColor: T.border,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontFamily: FONTS.bodyMed,
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabLottie source={ICONS.home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused }) => <TabLottie source={ICONS.calendar} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "",
          tabBarIcon: () => <CameraTabIcon T={T} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ focused }) => <TabLottie source={ICONS.stats} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabLottie source={ICONS.profile} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    cameraWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    cameraButton: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: T.green,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -20,
      shadowColor: T.green,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  });