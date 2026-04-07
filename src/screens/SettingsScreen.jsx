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
import { settingsService } from "../services";
import { Colors } from "../theme/colors";

export default function SettingsScreen({ navigation }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    (async () => {
      const settings = await settingsService.loadSettings();
      setNotificationsEnabled(settings.notificationsEnabled);
      setPublicProfileEnabled(settings.publicProfileEnabled);
      setDailySummaryEnabled(settings.dailySummaryEnabled);
      setLoadingSettings(false);
    })();
  }, []);

  if (loadingSettings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.green700} />
      </View>
    );
  }

  const updateSetting = async (key, value, setter) => {
    setter(value);
    const result = await settingsService.updateSetting(key, value);
    if (!result.success) {
      Alert.alert("Save failed", result.error || "Could not save settings.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={Colors.ink700}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Public profile</Text>
              <Text style={styles.settingDescription}>
                Let others discover your memories and profile details.
              </Text>
            </View>
            <Switch
              value={publicProfileEnabled}
              onValueChange={(value) =>
                updateSetting(
                  "publicProfileEnabled",
                  value,
                  setPublicProfileEnabled,
                )
              }
              thumbColor={publicProfileEnabled ? "#6cab90" : "#fff"}
              trackColor={{ false: "#C7C3BC", true: "#A8D6B8" }}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Daily summary</Text>
              <Text style={styles.settingDescription}>
                Receive a daily recap of recently added memories.
              </Text>
            </View>
            <Switch
              value={dailySummaryEnabled}
              onValueChange={(value) =>
                updateSetting(
                  "dailySummaryEnabled",
                  value,
                  setDailySummaryEnabled,
                )
              }
              thumbColor={dailySummaryEnabled ? "#6cab90" : "#fff"}
              trackColor={{ false: "#C7C3BC", true: "#A8D6B8" }}
            />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Push notifications</Text>
              <Text style={styles.settingDescription}>
                Stay updated when new memories are shared or changes happen.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(value) =>
                updateSetting(
                  "notificationsEnabled",
                  value,
                  setNotificationsEnabled,
                )
              }
              thumbColor={notificationsEnabled ? "#6cab90" : "#fff"}
              trackColor={{ false: "#C7C3BC", true: "#A8D6B8" }}
            />
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            These settings are stored locally for now. When Firebase is
            connected, they can be synced to your account.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E6E1DB",
  },
  settingText: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink700,
  },
  settingDescription: {
    marginTop: 4,
    color: Colors.ink500,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 6,
  },
  footerText: {
    color: Colors.ink500,
    fontSize: 13,
    lineHeight: 20,
  },
});
