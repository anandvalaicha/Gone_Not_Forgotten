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

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert("Validation", "All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Validation", "Passwords do not match.");
      return;
    }
    setLoading(true);
    const result = await authService.signUp(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      Alert.alert("Sign up failed", result.error || "Please check your inputs");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Logo seal */}
        <View style={styles.logoWrap}>
          <AppLogo size={72} />
        </View>

        <Text style={styles.brand}>Gone Not Forgotten</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.demoBox}>
          <Text style={styles.demoText}>
            Firebase is not connected yet. Use the demo login on the Sign In
            screen to try the app.
          </Text>
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
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={Colors.ink300}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={onSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating..." : "Sign Up"}
          </Text>
        </TouchableOpacity>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.link}>Sign In</Text>
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
  demoText: {
    color: Colors.ink500,
    fontSize: 13,
    lineHeight: 18,
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
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
