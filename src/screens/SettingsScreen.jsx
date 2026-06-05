import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { settingsService, authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";
import StatusBanner from "../components/StatusBanner";
import { useSignOut } from "../context/AuthContext";

// ─── Toggle row ───────────────────────────────────────────────────────────────
function SettingRow({ icon, label, description, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={Colors.green500} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? "#6cab90" : "#fff"}
        trackColor={{ false: "#C7C3BC", true: "#A8D6B8" }}
      />
    </View>
  );
}

// ─── Action / button row ──────────────────────────────────────────────────────
function ActionRow({ icon, label, description, onPress, destructive }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <MaterialCommunityIcons
          name={icon}
          size={19}
          color={destructive ? "#dc3545" : Colors.green500}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={destructive ? "#dc3545" : Colors.ink300}
      />
    </TouchableOpacity>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon} size={16} color={Colors.green700} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const signOut = useSignOut();
  const user = authService.getCurrentUser();

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [banner, setBanner] = useState(null);

  // Privacy & Visibility
  const [publicProfile, setPublicProfile] = useState(false);
  const [showLifeDates, setShowLifeDates] = useState(true);
  const [allowContributions, setAllowContributions] = useState(false);

  // Plaque QR Access
  const [qrProfile, setQrProfile] = useState(true);
  const [qrMemories, setQrMemories] = useState(true);
  const [qrGallery, setQrGallery] = useState(true);
  const [qrAudio, setQrAudio] = useState(false);

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [anniversaryReminders, setAnniversaryReminders] = useState(true);
  const [visitorAlerts, setVisitorAlerts] = useState(true);
  const [dailySummary, setDailySummary] = useState(true);

  useEffect(() => {
    settingsService.loadSettings().then((s) => {
      setPublicProfile(s.publicProfileEnabled ?? false);
      setShowLifeDates(s.showLifeDates ?? true);
      setAllowContributions(s.allowContributions ?? false);
      setQrProfile(s.qrAccess?.profile ?? true);
      setQrMemories(s.qrAccess?.memories ?? true);
      setQrGallery(s.qrAccess?.gallery ?? true);
      setQrAudio(s.qrAccess?.audio ?? false);
      setNotificationsEnabled(s.notificationsEnabled ?? true);
      setAnniversaryReminders(s.anniversaryReminders ?? true);
      setVisitorAlerts(s.visitorAlerts ?? true);
      setDailySummary(s.dailySummaryEnabled ?? true);
      setLoadingSettings(false);
    });
  }, []);

  const save = async (key, value, setter) => {
    setter(value);
    const result = await settingsService.updateSetting(key, value);
    if (!result.success) {
      setter(!value);
      setBanner({ type: "error", text: result.error || "Could not save setting." });
    } else {
      setBanner({ type: "success", text: "Saved." });
    }
  };

  const saveQr = async (key, value, setter) => {
    setter(value);
    const result = await settingsService.updateQrAccess(key, value);
    if (!result.success) {
      setter(!value);
      setBanner({ type: "error", text: result.error || "Could not save setting." });
    } else {
      setBanner({ type: "success", text: "Saved." });
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Change Password",
      `A password reset link will be sent to ${user?.email || "your email"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Link",
          onPress: async () => {
            if (!user?.email) return;
            const result = await authService.resetPassword(user.email);
            setBanner(
              result.success
                ? { type: "success", text: "Reset link sent to your email." }
                : { type: "error", text: result.error || "Could not send reset link." },
            );
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  if (loadingSettings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.green700} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.ink700} />
        </TouchableOpacity>
        <AppLogo size={32} />
        <Text style={[styles.title, { marginLeft: 8 }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <StatusBanner type={banner?.type} message={banner?.text} />

        {/* ── Privacy & Visibility ── */}
        <View style={styles.section}>
          <SectionHeader icon="shield-account" title="Privacy & Visibility" />
          <SettingRow
            icon="earth"
            label="Public profile"
            description="Allow anyone to find and view your memorial profile."
            value={publicProfile}
            onValueChange={(v) => save("publicProfileEnabled", v, setPublicProfile)}
          />
          <SettingRow
            icon="calendar-range"
            label="Show life dates"
            description="Display birth and death years on your public profile."
            value={showLifeDates}
            onValueChange={(v) => save("showLifeDates", v, setShowLifeDates)}
          />
          <SettingRow
            icon="account-multiple-plus"
            label="Allow contributions"
            description="Let others add memories and photos to your memorial."
            value={allowContributions}
            onValueChange={(v) => save("allowContributions", v, setAllowContributions)}
          />
        </View>

        {/* ── Plaque QR Access ── */}
        <View style={styles.section}>
          <SectionHeader icon="qrcode" title="Plaque QR Access" />
          <Text style={styles.sectionNote}>
            Choose what visitors see when they scan your plaque QR code.
          </Text>
          <SettingRow
            icon="account-circle-outline"
            label="Profile info"
            description="Show your name, photo, and bio."
            value={qrProfile}
            onValueChange={(v) => saveQr("profile", v, setQrProfile)}
          />
          <SettingRow
            icon="book-open-variant"
            label="Memories"
            description="Show your memorial posts and stories."
            value={qrMemories}
            onValueChange={(v) => saveQr("memories", v, setQrMemories)}
          />
          <SettingRow
            icon="image-multiple-outline"
            label="Photo gallery"
            description="Show your photo and video collection."
            value={qrGallery}
            onValueChange={(v) => saveQr("gallery", v, setQrGallery)}
          />
          <SettingRow
            icon="headphones"
            label="Audio clips"
            description="Share recorded audio with visitors."
            value={qrAudio}
            onValueChange={(v) => saveQr("audio", v, setQrAudio)}
          />
        </View>

        {/* ── Notifications ── */}
        <View style={styles.section}>
          <SectionHeader icon="bell" title="Notifications" />
          <SettingRow
            icon="bell-ring-outline"
            label="Push notifications"
            description="Receive all app notifications on this device."
            value={notificationsEnabled}
            onValueChange={(v) => save("notificationsEnabled", v, setNotificationsEnabled)}
          />
          <SettingRow
            icon="heart-pulse"
            label="Anniversary reminders"
            description="Get reminded on death anniversaries and birthdays."
            value={anniversaryReminders}
            onValueChange={(v) => save("anniversaryReminders", v, setAnniversaryReminders)}
          />
          <SettingRow
            icon="qrcode-scan"
            label="Visitor alerts"
            description="Notify me when someone scans my plaque QR code."
            value={visitorAlerts}
            onValueChange={(v) => save("visitorAlerts", v, setVisitorAlerts)}
          />
          <SettingRow
            icon="newspaper-variant-outline"
            label="Daily summary"
            description="A daily recap of recent memories and activity."
            value={dailySummary}
            onValueChange={(v) => save("dailySummaryEnabled", v, setDailySummary)}
          />
        </View>

        {/* ── Account ── */}
        <View style={styles.section}>
          <SectionHeader icon="account-cog" title="Account" />
          <ActionRow
            icon="lock-reset"
            label="Change password"
            description={user?.email ? `Linked to ${user.email}` : "Send a reset link to your email."}
            onPress={handleChangePassword}
          />
          <ActionRow
            icon="logout"
            label="Sign out"
            description="Sign out of your account on this device."
            onPress={handleSignOut}
            destructive
          />
        </View>

        <Text style={styles.versionText}>Gone Not Forgotten · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDE8E1",
  },
  container: {
    flex: 1,
    backgroundColor: "#EDE8E1",
  },
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Section card
  section: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBE4",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.green700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionNote: {
    fontSize: 12,
    color: Colors.ink500,
    lineHeight: 17,
    marginBottom: 4,
    marginTop: -2,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0EBE4",
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(77,148,120,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  rowIconDestructive: {
    backgroundColor: "rgba(220,53,69,0.08)",
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink700,
  },
  rowLabelDestructive: {
    color: "#dc3545",
  },
  rowDesc: {
    fontSize: 12,
    color: Colors.ink500,
    lineHeight: 17,
    marginTop: 2,
  },

  // Footer
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.ink300,
    marginTop: 4,
    marginBottom: 8,
  },
});
