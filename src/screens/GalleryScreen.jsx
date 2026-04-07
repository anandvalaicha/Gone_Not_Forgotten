import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

export default function GalleryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gallery</Text>
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
