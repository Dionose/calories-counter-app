// app/(tabs)/_layout.tsx
// The tab bar. The camera sits in the middle as a raised button, and tapping
// the tab you're already on fires resetTab() so that tab drops back to its
// root — Stats leaves its detail view, Profile leaves the account screen.
import { Tabs } from "expo-router";
import { BarChart3, CalendarDays, Camera, Home, User } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Paywall from "../../components/Paywall";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";

export default function TabsLayout() {
  const { T, resetTab } = useApp();
  const s = styles(T);

  /* Fires on every tab press. If the tab is already focused, we bump the reset
     key instead of navigating — that's what lets a sub-view close from the tab
     bar rather than trapping you until you find the back arrow. */
  const listeners = ({ navigation, route }: any) => ({
    tabPress: () => {
      const focused = navigation.isFocused();
      if (focused) {
        H.tap();
        resetTab();
      }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: T.green,
          tabBarInactiveTintColor: T.micro,
          tabBarStyle: s.bar,
          tabBarLabelStyle: s.label,
          tabBarItemStyle: { paddingTop: 6 },
          sceneStyle: { backgroundColor: T.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
          }}
          listeners={listeners}
        />

        {/* the raised camera button */}
        <Tabs.Screen
          name="camera"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={s.camWrap}>
                <View style={s.camBtn}>
                  <Camera size={26} color={T.ink} />
                </View>
              </View>
            ),
          }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} />,
          }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
          listeners={listeners}
        />
      </Tabs>

      {/* the paywall lives above the tabs so it covers the bar too */}
      <Paywall />
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    bar: {
      backgroundColor: T.bg,
      borderTopWidth: 1,
      borderTopColor: T.border,
      height: Platform.OS === "ios" ? 88 : 68,
      paddingBottom: Platform.OS === "ios" ? 28 : 10,
      paddingTop: 6,
    },
    label: { fontSize: 10, marginTop: 2 },
    camWrap: { alignItems: "center", justifyContent: "center" },
    camBtn: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: T.green,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      shadowColor: T.green,
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
  });