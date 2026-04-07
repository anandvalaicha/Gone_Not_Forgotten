import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  Modal,
  Switch,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { authService, settingsService } from "../services";
import { Colors } from "../theme/colors";

const DEMO_AVATAR =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80";

export default function QRCodeScreen({ navigation }) {
  const user = authService.getCurrentUser();
  const userId = user?.uid || "demo-user-001";
  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0]?.replace(/[._]/g, " ") ||
    "Your Memorial";
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [qrAccess, setQrAccess] = useState({
    profile: true,
    memories: true,
    gallery: true,
    audio: false,
  });

  useEffect(() => {
    const loadQrAccess = async () => {
      const settings = await settingsService.loadSettings();
      if (settings?.qrAccess) {
        setQrAccess(settings.qrAccess);
      }
    };
    loadQrAccess();
  }, []);

  const getAccessParam = () => {
    return Object.keys(qrAccess)
      .filter((key) => qrAccess[key])
      .join(",");
  };

  const qrValue = `https://gonenotforgotten.app/profile/${userId}?access=${encodeURIComponent(
    getAccessParam(),
  )}`;

  const shareDescription = () => {
    const allowed = Object.keys(qrAccess)
      .filter((key) => qrAccess[key])
      .map((key) => {
        switch (key) {
          case "profile":
            return "profile details";
          case "memories":
            return "memories";
          case "gallery":
            return "gallery";
          case "audio":
            return "audio";
          default:
            return key;
        }
      });
    return allowed.length > 0 ? allowed.join(", ") : "nothing";
  };

  const onShareLink = async () => {
    try {
      await Share.share({
        message: `View my profile on GoneNotForgotten: ${qrValue}\nAccess: ${shareDescription()}`,
        url: qrValue,
      });
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const saveQrAccess = async (updatedAccess) => {
    setQrAccess(updatedAccess);
    const result = await settingsService.updateSetting(
      "qrAccess",
      updatedAccess,
    );
    if (!result.success) {
      Alert.alert(
        "Save failed",
        result.error || "Could not save QR access settings.",
      );
    }
  };

  const toggleAccess = (key) => {
    const updated = { ...qrAccess, [key]: !qrAccess[key] };
    saveQrAccess(updated);
  };

  const accessSummary = shareDescription();

  return (
    <View style={styles.container}>
      {/* Soft blurred top glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleArea}>
        <Text style={styles.title}>My Profile QR</Text>
        <Text style={styles.subtitle}>Scan to visit my profile page</Text>
      </View>

      {/* QR Card */}
      <View style={styles.centerArea}>
        {/* Outer glow ring */}
        <View style={styles.glowRing}>
          <View style={styles.qrCard}>
            {/* Name above QR */}
            <Text style={styles.qrName}>{displayName}</Text>
            <View style={styles.divider} />

            <View style={styles.qrWrapper}>
              <QRCode
                value={qrValue}
                size={210}
                color="#1A1A1A"
                backgroundColor="#FFFFFF"
              />
              {/* Avatar center */}
              <View style={styles.avatarOverlay}>
                <Image
                  source={{ uri: DEMO_AVATAR }}
                  style={styles.avatarImage}
                />
              </View>
            </View>

            {/* URL label */}
            <View style={styles.urlRow}>
              <MaterialCommunityIcons
                name="link-variant"
                size={14}
                color={Colors.green700}
              />
              <Text style={styles.urlText} numberOfLines={1}>
                gonenotforgotten.app
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom buttons */}
      <View style={styles.accessNote}>
        <Text style={styles.accessNoteText}>
          Allowed via QR: {accessSummary}
        </Text>
      </View>
      <View style={styles.bottomBtns}>
        <TouchableOpacity style={styles.shareBtn} onPress={onShareLink}>
          <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>Share a link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => setAccessModalVisible(true)}
        >
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={18}
            color="#fff"
          />
          <Text style={styles.manageBtnText}>Manage access</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={accessModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage QR access</Text>
            <Text style={styles.modalHint}>
              Choose what the scanned user can see from your profile.
            </Text>
            {[
              { key: "profile", label: "Profile details" },
              { key: "memories", label: "Memories" },
              { key: "gallery", label: "Gallery" },
              { key: "audio", label: "Audio recordings" },
            ].map((item) => (
              <View key={item.key} style={styles.accessRow}>
                <View style={styles.accessText}>
                  <Text style={styles.accessLabel}>{item.label}</Text>
                  <Text style={styles.accessDescription}>
                    {item.key === "profile"
                      ? "Name, avatar, and bio"
                      : item.key === "memories"
                        ? "Shared memory stories"
                        : item.key === "gallery"
                          ? "Shared photo gallery"
                          : "Uploaded audio clips"}
                  </Text>
                </View>
                <Switch
                  value={qrAccess[item.key]}
                  onValueChange={() => toggleAccess(item.key)}
                  thumbColor={qrAccess[item.key] ? "#6cab90" : "#fff"}
                  trackColor={{ false: "#C7C3BC", true: "#A8D6B8" }}
                />
              </View>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setAccessModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3D3D3D",
  },

  // Ambient glow blobs
  glowTop: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.green700,
    opacity: 0.18,
  },
  glowBottom: {
    position: "absolute",
    bottom: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.green700,
    opacity: 0.12,
  },

  // Back button
  backBtn: {
    position: "absolute",
    top: 56,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  // Title
  titleArea: {
    paddingTop: 64,
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
  },

  // Outer glow ring around card
  glowRing: {
    borderRadius: 36,
    padding: 2,
    backgroundColor: "rgba(108,171,144,0.3)",
    shadowColor: Colors.green700,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },

  // Center area
  centerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  // White QR card
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 34,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: "center",
    gap: 14,
  },
  qrName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    textTransform: "capitalize",
  },
  divider: {
    width: "80%",
    height: 1,
    backgroundColor: "#F0EDE8",
  },

  // QR code wrapper
  qrWrapper: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  // Avatar in center of QR
  avatarOverlay: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },

  // URL row
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4FAF7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  urlText: {
    fontSize: 12,
    color: Colors.green700,
    fontWeight: "600",
  },

  accessNote: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  accessNoteText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#f7f5f0",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 24,
    minHeight: 420,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 14,
    color: Colors.ink500,
    lineHeight: 20,
    marginBottom: 20,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E0D9",
  },
  accessText: {
    flex: 1,
    paddingRight: 12,
  },
  accessLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 4,
  },
  accessDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink500,
  },
  modalActions: {
    marginTop: 20,
    alignItems: "center",
  },
  modalButton: {
    width: "100%",
    backgroundColor: Colors.green700,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Bottom buttons
  bottomBtns: {
    paddingHorizontal: 24,
    paddingBottom: 50,
    gap: 10,
  },
  shareBtn: {
    backgroundColor: Colors.green700,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.green700,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  manageBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  manageBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
