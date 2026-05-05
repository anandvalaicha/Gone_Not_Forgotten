import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Inline success / error banner for forms.
 * Usage: <StatusBanner type="success" message="Saved!" />
 *        <StatusBanner type="error"   message="Something went wrong." />
 * Renders nothing when message is empty / null.
 */
export default function StatusBanner({ type, message }) {
  if (!message) return null;
  const ok = type === "success";
  return (
    <View style={[styles.banner, ok ? styles.successBanner : styles.errorBanner]}>
      <Ionicons
        name={ok ? "checkmark-circle-outline" : "alert-circle-outline"}
        size={16}
        color={ok ? "#1a7a4a" : "#C0392B"}
        style={styles.icon}
      />
      <Text style={[styles.text, ok ? styles.successText : styles.errorText]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: "#EAF7EF",
    borderWidth: 1,
    borderColor: "#A8D6B8",
  },
  errorBanner: {
    backgroundColor: "#FDECEA",
    borderWidth: 1,
    borderColor: "#F5C6C2",
  },
  icon: {
    marginRight: 8,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  successText: {
    color: "#1a7a4a",
  },
  errorText: {
    color: "#C0392B",
  },
});
