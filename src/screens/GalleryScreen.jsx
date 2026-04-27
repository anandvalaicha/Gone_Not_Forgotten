import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

export default function GalleryScreen() {
  return (
    <View style={styles.container}>
      <AppLogo size={56} />
      <Text style={[styles.title, { marginTop: 16 }]}>Gallery</Text>
      <Text style={styles.subtitle}>Coming soon — memorial media gallery</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.green700,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.ink500,
    fontSize: 14,
  },
});
