// app/(tabs)/_layout.tsx
// The tab bar. The camera sits in the middle as a raised button, and tapping
// the tab you're already on fires resetTab() so that tab drops back to its
// root — Stats leaves its detail view, Profile leaves the account screen.
//
// ICONS: all five loop, always. The animations are deliberately subtle — you
// notice movement without being able to point at it — and an idle camera icon
// that looks like it's taking a picture invites the tap, which is the whole
// reason for animating them.
//
// "You are here" is carried by OPACITY and the label, not by colour: every
// icon is the same pre-recoloured green (a Lottie's colour is baked in and
// can't be tinted at runtime), so the active tab sits at full brightness and
// the rest at 80%. Enough to read as current without the others looking
// disabled.
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Icon, { IconName } from "../../components/Icon";
import Paywall from "../../components/Paywall";
import { useApp } from "../../constants/AppState";
import * as H from "../../constants/haptics";

/* the gap that says "you're on this one" without dimming the others into
   looking switched off */
const ACTIVE_OPACITY = 1;
const IDLE_OPACITY = 0.8;

export default function TabsLayout() {
  const { T, resetTab } = useApp();
  const s = styles(T);

  /* Fires on every tab press. If the tab is already focused, we bump the reset
     key instead of navigating — that's what lets a sub-view close from the tab
     bar rather than trapping you until you find the back arrow. */
  const listeners = ({ navigation }: any) => ({
    tabPress: () => {
      if (navigation.isFocused()) {
        H.tap();
        resetTab();
      }
    },
  });

  const tabIcon =
    (anim: IconName) =>
    ({ focused }: { focused: boolean }) => (
      <Icon
        name={anim}
        size={24}
        mode="loop"
        style={{ opacity: focused ? ACTIVE_OPACITY : IDLE_OPACITY }}
      />
    );

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
          options={{ title: "Home", tabBarIcon: tabIcon("home") }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="calendar"
          options={{ title: "Calendar", tabBarIcon: tabIcon("calendar") }}
          listeners={listeners}
        />

        {/* the raised camera button — the DARK animation, since it sits on a
            green fill where the green version would disappear. Always full
            opacity: it's the primary action, not a peer of the other four. */}
        <Tabs.Screen
          name="camera"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={s.camWrap}>
                <View style={s.camBtn}>
                  <Icon name="cameraDark" size={26} mode="loop" />
                </View>
              </View>
            ),
          }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="stats"
          options={{ title: "Stats", tabBarIcon: tabIcon("stats") }}
          listeners={listeners}
        />

        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: tabIcon("profile") }}
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