import { Tabs } from "expo-router";
import { BarChart3, Calendar, Camera, Home, User } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

const C = {
  bg: "#0C0C0C",
  border: "#242424",
  green: "#22C55E",
  micro: "#6A6A6A",
};

function CameraButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cameraButton}>
      <Camera size={24} color="#0A0A0A" strokeWidth={2.4} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.micro,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "",
          tabBarIcon: () => (
            <View style={styles.cameraWrap}>
              <View style={styles.cameraButton}>
                <Camera size={24} color="#0A0A0A" strokeWidth={2.4} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: C.green,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});