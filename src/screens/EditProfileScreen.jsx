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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function EditProfileScreen({ navigation, route }) {
  const {
    currentFirstName = "",
    currentLastName = "",
    currentEmail = "",
    currentPhone = "",
    currentAge = "",
    currentGender = "",
    currentBio = "",
    currentBirthYear = "",
    currentDeathYear = "",
  } = route.params || {};

  // Personal info
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [phone, setPhone] = useState(currentPhone);
  const [age, setAge] = useState(currentAge);
  const [gender, setGender] = useState(currentGender);

  // Profile info
  const [bio, setBio] = useState(currentBio);
  const [birthYear, setBirthYear] = useState(currentBirthYear);
  const [deathYear, setDeathYear] = useState(currentDeathYear);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  const lastNameRef = useRef(null);
  const phoneRef = useRef(null);
  const ageRef = useRef(null);
  const bioRef = useRef(null);
  const birthYearRef = useRef(null);
  const deathYearRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Name required", "Please enter your first and last name.");
      return;
    }
    if (age && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)) {
      Alert.alert("Invalid age", "Please enter a valid age between 1 and 120.");
      return;
    }
    if (showPasswordSection) {
      if (!newPassword) {
        Alert.alert("Password required", "Please enter a new password.");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert(
          "Password too short",
          "Password must be at least 6 characters.",
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert(
          "Passwords don't match",
          "New password and confirmation do not match.",
        );
        return;
      }
    }

    setSaving(true);

    const profileResult = await authService.updateUserProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender,
      bio: bio.trim(),
      birthYear: birthYear.trim(),
      deathYear: deathYear.trim(),
    });

    if (!profileResult.success) {
      setSaving(false);
      Alert.alert(
        "Save failed",
        profileResult.error || "Could not update profile.",
      );
      return;
    }

    if (showPasswordSection && newPassword) {
      const pwResult = await authService.changePassword(newPassword);
      if (!pwResult.success) {
        setSaving(false);
        Alert.alert(
          "Password update failed",
          pwResult.error || "Could not change password.",
        );
        return;
      }
    }

    setSaving(false);
    Alert.alert("Profile updated", "Your changes have been saved.", [
      {
        text: "OK",
        onPress: () =>
          navigation.navigate("Profile", {
            updatedName: `${firstName.trim()} ${lastName.trim()}`,
            updatedBio: bio.trim(),
            updatedBirthYear: birthYear.trim(),
            updatedDeathYear: deathYear.trim(),
          }),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#EDE8E1" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color={Colors.ink700}
            />
          </TouchableOpacity>
          <AppLogo size={32} />
          <Text style={[styles.title, { marginLeft: 8 }]}>Edit Profile</Text>
        </View>

        <View style={styles.form}>
          {/* ── Personal Info ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Personal Info</Text>

          <View style={styles.row}>
            <View style={styles.halfWrap}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={Colors.ink300}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            <View style={styles.halfWrap}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                ref={lastNameRef}
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={Colors.ink300}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            ref={phoneRef}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number (optional)"
            placeholderTextColor={Colors.ink300}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => ageRef.current?.focus()}
            blurOnSubmit={false}
          />

          <View style={styles.row}>
            <View style={{ width: 100 }}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                ref={ageRef}
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Age"
                placeholderTextColor={Colors.ink300}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="next"
                onSubmitEditing={() => bioRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.label}>Gender</Text>
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

          {/* ── Account ───────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Account</Text>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.readOnlyWrap}>
            <MaterialCommunityIcons
              name="email-outline"
              size={16}
              color={Colors.ink300}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.readOnlyText}>
              {currentEmail || "No email on file"}
            </Text>
          </View>

          {/* ── Profile ───────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Profile</Text>

          <Text style={styles.label}>Bio</Text>
          <TextInput
            ref={bioRef}
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write a short bio"
            placeholderTextColor={Colors.ink300}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="next"
            blurOnSubmit={true}
            onSubmitEditing={() => birthYearRef.current?.focus()}
          />

          <View style={styles.row}>
            <View style={styles.halfWrap}>
              <Text style={styles.label}>Birth Year</Text>
              <TextInput
                ref={birthYearRef}
                style={styles.input}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder="e.g. 1948"
                placeholderTextColor={Colors.ink300}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="next"
                onSubmitEditing={() => deathYearRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            <View style={styles.halfWrap}>
              <Text style={styles.label}>Death Year</Text>
              <TextInput
                ref={deathYearRef}
                style={styles.input}
                value={deathYear}
                onChangeText={setDeathYear}
                placeholder="e.g. 2023"
                placeholderTextColor={Colors.ink300}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          {/* ── Change Password ───────────────────────────────────── */}
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => {
              setShowPasswordSection(!showPasswordSection);
              setNewPassword("");
              setConfirmPassword("");
            }}
          >
            <MaterialCommunityIcons
              name="lock-outline"
              size={18}
              color={Colors.green700}
            />
            <Text style={styles.passwordToggleText}>
              {showPasswordSection
                ? "Cancel Password Change"
                : "Change Password"}
            </Text>
            <MaterialCommunityIcons
              name={showPasswordSection ? "chevron-up" : "chevron-down"}
              size={18}
              color={Colors.green700}
            />
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordSection}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  ref={newPasswordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password (min. 6 chars)"
                  placeholderTextColor={Colors.ink300}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNew(!showNew)}
                >
                  <MaterialCommunityIcons
                    name={showNew ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.ink300}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  ref={confirmPasswordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.ink300}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <MaterialCommunityIcons
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Colors.ink300}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Save Button ───────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.25)",
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.ink700,
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.green700,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWrap: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: Colors.ink700,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: Colors.ink100,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
    color: Colors.ink700,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  readOnlyWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderColor: Colors.ink100,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  readOnlyText: {
    color: Colors.ink500,
    fontSize: 15,
  },
  genderOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  genderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ink100,
    backgroundColor: "#fff",
  },
  genderChipActive: {
    backgroundColor: Colors.green700,
    borderColor: Colors.green700,
  },
  genderChipText: {
    fontSize: 12,
    color: Colors.ink700,
    fontWeight: "500",
  },
  genderChipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(108,171,144,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.3)",
    marginBottom: 16,
    marginTop: 4,
  },
  passwordToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.green700,
  },
  passwordSection: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink100,
    padding: 16,
    marginBottom: 16,
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 13,
  },
  button: {
    backgroundColor: Colors.green700,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
