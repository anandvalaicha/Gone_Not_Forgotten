import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Email and password are required.");
      return;
    }
    setLoading(true);
    const result = await authService.signIn(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert(
        "Sign in failed",
        result.error || "Please check your credentials",
      );
    }
  };

  const onGoogleSignIn = async () => {
    setLoading(true);
    const result = await authService.signInWithGoogle();
    setLoading(false);
    if (!result.success) {
      Alert.alert("Google sign in failed", result.error || "Please try again");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Logo — Option 1: Butterfly + Bookmark */}
        <View style={styles.logoWrap}>
          <AppLogo size={72} />
        </View>

        <Text style={styles.brand}>Gone Not Forgotten</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Temporary demo login</Text>
          <Text style={styles.demoText}>Email: demo@gonenotforgotten.com</Text>
          <Text style={styles.demoText}>Password: Demo@1234</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.ink300}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.ink300}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={onSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={onGoogleSignIn}
          disabled={loading}
        >
          <Text style={styles.outlineButtonText}>Sign In with Google</Text>
        </TouchableOpacity>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
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

  // Logo seal
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
    marginBottom: 20,
  },
  demoBox: {
    backgroundColor: Colors.ink100,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  demoTitle: {
    color: Colors.ink700,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  demoText: {
    color: Colors.ink500,
    fontSize: 13,
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
    marginBottom: 10,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  outlineButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.green700,
    backgroundColor: "transparent",
  },
  outlineButtonText: {
    color: Colors.green700,
    fontWeight: "600",
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  switchText: {
    color: Colors.ink500,
    fontSize: 14,
  },
  link: {
    marginLeft: 6,
    color: Colors.green700,
    fontWeight: "700",
    fontSize: 14,
  },
});
