import { StyleSheet, Text, View } from "react-native";

export default function Camera() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Camera</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 24, color: "#F5F5F5" },
});