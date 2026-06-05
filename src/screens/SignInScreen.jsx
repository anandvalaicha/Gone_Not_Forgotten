import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";
import StatusBanner from "../components/StatusBanner";

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const passwordRef = useRef(null);

  const clearBanner = () => setBanner(null);

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      setBanner({ type: "error", text: "Email and password are required." });
      return;
    }
    clearBanner();
    setLoading(true);
    const result = await authService.signIn(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      setBanner({ type: "error", text: result.error || "Incorrect email or password. Please try again." });
    }
  };

  const onGoogleSignIn = async () => {
    clearBanner();
    setLoading(true);
    const result = await authService.signInWithGoogle();
    setLoading(false);
    if (!result.success) {
      setBanner({ type: "error", text: result.error || "Google sign in failed. Please try again." });
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

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.ink300}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(v) => { setEmail(v); clearBanner(); }}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.ink300}
          secureTextEntry
          value={password}
          onChangeText={(v) => { setPassword(v); clearBanner(); }}
          returnKeyType="done"
          onSubmitEditing={onSignIn}
        />
        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
        <StatusBanner type={banner?.type} message={banner?.text} />
        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
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
  forgotRow: {
    alignSelf: "flex-end",
    marginBottom: 10,
    marginTop: -4,
  },
  forgotText: {
    color: Colors.green700,
    fontSize: 13,
    fontWeight: "600",
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
