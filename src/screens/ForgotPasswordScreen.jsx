// UI screen for ForgotPassword

import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import * as Linking from "expo-linking";
import { authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";
import StatusBanner from "../components/StatusBanner";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [sent, setSent] = useState(false);

  const onSendReset = async () => {
    if (!email.trim()) {
      setBanner({ type: "error", text: "Please enter your email address." });
      return;
    }
    setBanner(null);
    setLoading(true);
    const redirectTo = Linking.createURL("reset-password");
    const result = await authService.resetPassword(email.trim(), redirectTo);
    setLoading(false);
    if (result.success) {
      setSent(true);
      setBanner({
        type: "success",
        text: `Reset link sent to ${email.trim()}. Check your inbox and follow the link to set a new password.`,
      });
    } else {
      setBanner({ type: "error", text: result.error || "Could not send reset email. Please try again." });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <AppLogo size={72} />
        </View>

        <Text style={styles.brand}>Gone Not Forgotten</Text>
        <Text style={styles.subtitle}>Reset your password</Text>
        <Text style={styles.hint}>
          Enter the email address linked to your account and we'll send you a reset link.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={Colors.ink300}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(v) => { setEmail(v); if (banner?.type === "error") setBanner(null); }}
          editable={!sent}
        />

        <StatusBanner type={banner?.type} message={banner?.text} />

        {!sent ? (
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={onSendReset}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.navigate("SignIn")}
        >
          <Text style={styles.backText}>
            {sent ? "Back to Sign In" : "Back to Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.cream,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.ink100,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  brand: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.green700,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.ink500,
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: Colors.ink500,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 19,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Colors.ink100,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.white,
    marginBottom: 12,
    color: Colors.ink700,
  },
  button: {
    backgroundColor: Colors.green700,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  backRow: {
    alignItems: "center",
    marginTop: 8,
  },
  backText: {
    color: Colors.green700,
    fontWeight: "600",
    fontSize: 14,
  },
});
