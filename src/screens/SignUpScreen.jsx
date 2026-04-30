import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function SignUpScreen({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const ageRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const onSignUp = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        "Validation",
        "First name, last name, email and password are required.",
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Validation", "Passwords do not match.");
      return;
    }
    if (age && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)) {
      Alert.alert("Validation", "Please enter a valid age.");
      return;
    }
    setLoading(true);
    const result = await authService.signUp(email.trim(), password, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert("Sign up failed", result.error || "Please check your inputs");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.cream }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logoWrap}>
            <AppLogo size={72} />
          </View>
          <Text style={styles.brand}>Gone Not Forgotten</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {/* Name row */}
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="First name"
              placeholderTextColor={Colors.ink300}
              autoCapitalize="words"
              value={firstName}
              onChangeText={setFirstName}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TextInput
              ref={lastNameRef}
              style={[styles.input, styles.halfInput]}
              placeholder="Last name"
              placeholderTextColor={Colors.ink300}
              autoCapitalize="words"
              value={lastName}
              onChangeText={setLastName}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Email */}
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={Colors.ink300}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            blurOnSubmit={false}
          />

          {/* Phone */}
          <TextInput
            ref={phoneRef}
            style={styles.input}
            placeholder="Phone number (optional)"
            placeholderTextColor={Colors.ink300}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            returnKeyType="next"
            onSubmitEditing={() => ageRef.current?.focus()}
            blurOnSubmit={false}
          />

          {/* Age + Gender row */}
          <View style={styles.row}>
            <TextInput
              ref={ageRef}
              style={[styles.input, styles.ageInput]}
              placeholder="Age"
              placeholderTextColor={Colors.ink300}
              keyboardType="number-pad"
              maxLength={3}
              value={age}
              onChangeText={setAge}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View style={styles.genderWrap}>
              <Text style={styles.genderLabel}>Gender</Text>
              <View style={styles.genderOptions}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderChip,
                      gender === g && styles.genderChipActive,
                    ]}
                    onPress={() => setGender(g === gender ? "" : g)}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        gender === g && styles.genderChipTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Password */}
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.ink300}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={Colors.ink300}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            returnKeyType="done"
            onSubmitEditing={onSignUp}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={onSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <Text style={styles.forgotText}>Forgot your password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingVertical: 40,
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
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 0,
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
  halfInput: {
    flex: 1,
  },
  ageInput: {
    width: 90,
    flexShrink: 0,
  },
  genderWrap: {
    flex: 1,
    marginBottom: 12,
  },
  genderLabel: {
    fontSize: 12,
    color: Colors.ink500,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 2,
  },
  genderOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  genderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ink100,
    backgroundColor: Colors.white,
  },
  genderChipActive: {
    backgroundColor: Colors.green700,
    borderColor: Colors.green700,
  },
  genderChipText: {
    fontSize: 12,
    color: Colors.ink600,
    fontWeight: "500",
  },
  genderChipTextActive: {
    color: Colors.white,
    fontWeight: "700",
  },
  button: {
    backgroundColor: Colors.green700,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 4,
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
  forgotRow: {
    alignItems: "center",
    marginTop: 10,
  },
  forgotText: {
    color: Colors.green700,
    fontSize: 13,
    fontWeight: "600",
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
