import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services";
import { supabase } from "../config/supabase";
import { useOnPasswordReset } from "../context/AuthContext";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const EMPTY_ERRORS = { password: "", confirm: "", general: "" };

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const onPasswordReset = useOnPasswordReset();
  const timerRef = useRef(null);

  // Auto-navigate to login 2 seconds after success banner appears
  useEffect(() => {
    if (saved) {
      timerRef.current = setTimeout(() => {
        onPasswordReset();
      }, 2000);
    }
    return () => clearTimeout(timerRef.current);
  }, [saved]);

  const clearError = (field) =>
    setErrors((prev) => ({ ...prev, [field]: "" }));

  const onSave = async () => {
    // ── Client-side validation ─────────────────────────────────────────────
    const next = { ...EMPTY_ERRORS };
    let hasError = false;

    if (!password) {
      next.password = "New password is required.";
      hasError = true;
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters.";
      hasError = true;
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      next.password = "Password must contain at least one letter and one number.";
      hasError = true;
    }

    if (!confirmPassword) {
      next.confirm = "Please confirm your new password.";
      hasError = true;
    } else if (password && password !== confirmPassword) {
      next.confirm = "Passwords do not match.";
      hasError = true;
    }

    if (hasError) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors(EMPTY_ERRORS);

    // ── Same-as-old-password check ─────────────────────────────────────────
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (sessionUser?.email) {
      const { error: sameErr } = await supabase.auth.signInWithPassword({
        email: sessionUser.email,
        password,
      });
      if (!sameErr) {
        setErrors((prev) => ({
          ...prev,
          password: "New password cannot be the same as your current password.",
        }));
        setLoading(false);
        return;
      }
    }

    // ── Save new password ──────────────────────────────────────────────────
    const result = await authService.changePassword(password);
    setLoading(false);

    if (result.success) {
      setSaved(true);
    } else {
      setErrors((prev) => ({
        ...prev,
        general: result.error || "Could not update password. Please try again.",
      }));
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (saved) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.green700} />
          </View>
          <Text style={styles.successTitle}>Password Saved!</Text>
          <Text style={styles.successMsg}>
            Your password has been updated successfully.{"\n"}
            Taking you to sign in…
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              clearTimeout(timerRef.current);
              onPasswordReset();
            }}
          >
            <Text style={styles.buttonText}>Sign In Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <AppLogo size={72} />
        </View>

        <Text style={styles.brand}>Gone Not Forgotten</Text>
        <Text style={styles.subtitle}>Set a new password</Text>
        <Text style={styles.hint}>
          At least 6 characters with letters and numbers. Cannot be the same as
          your old password.
        </Text>

        {/* New password */}
        <View
          style={[styles.inputWrap, errors.password ? styles.inputError : null]}
        >
          <TextInput
            style={styles.inputInner}
            placeholder="New password"
            placeholderTextColor={Colors.ink300}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearError("password");
            }}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={Colors.ink400}
            />
          </TouchableOpacity>
        </View>
        {errors.password ? (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={12} /> {errors.password}
          </Text>
        ) : null}

        {/* Confirm password */}
        <View
          style={[styles.inputWrap, errors.confirm ? styles.inputError : null]}
        >
          <TextInput
            style={styles.inputInner}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.ink300}
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              clearError("confirm");
            }}
          />
          <TouchableOpacity
            onPress={() => setShowConfirm((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showConfirm ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={Colors.ink400}
            />
          </TouchableOpacity>
        </View>
        {errors.confirm ? (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={12} /> {errors.confirm}
          </Text>
        ) : null}

        {/* Server / session error banner */}
        {errors.general ? (
          <View style={styles.generalErrorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color="#C0392B"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Saving…" : "Save Password"}
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
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: Colors.ink100,
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 4,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: "#E74C3C",
    backgroundColor: "#FFF8F8",
  },
  inputInner: {
    flex: 1,
    fontSize: 15,
    color: Colors.ink700,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#E74C3C",
    marginBottom: 10,
    marginLeft: 4,
  },
  generalErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  generalErrorText: {
    flex: 1,
    fontSize: 13,
    color: "#C0392B",
  },
  button: {
    backgroundColor: Colors.green700,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Success screen ─────────────────────────────────────────────────────────
  successIconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.green700,
    textAlign: "center",
    marginBottom: 10,
  },
  successMsg: {
    fontSize: 14,
    color: Colors.ink500,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
});
