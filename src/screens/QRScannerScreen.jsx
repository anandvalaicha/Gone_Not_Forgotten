import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

export default function QRScannerScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
  }, []);

  // ── Parse a raw QR value or manually pasted URL into { userId, access, plaqueId } ──
  const parseProfileLink = (raw) => {
    const result = { userId: null, access: null, plaqueId: null };
    if (!raw) return result;
    try {
      const trimmed = raw.trim();

      if (trimmed.includes("/profile/")) {
        const tail = trimmed.split("/profile/").pop();
        const [idPart, queryPart] = tail.split("?");
        result.userId = idPart || null;
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const accessParam = params.get("access");
          if (accessParam)
            result.access = accessParam.split(",").filter(Boolean);
          const plaqueParam = params.get("plaque");
          if (plaqueParam) result.plaqueId = plaqueParam;
        }
      } else if (trimmed.includes("/memorial/")) {
        result.userId = trimmed.split("/memorial/").pop() || null;
      } else if (trimmed.includes("/plaque/")) {
        // Legacy plaque URL — no userId embedded, nothing we can show
        result.userId = null;
      } else {
        // Treat the raw value as a userId directly
        result.userId = trimmed || null;
      }
    } catch (_) {}
    return result;
  };

  const navigateToProfile = (userId, access, plaqueId) => {
    if (!userId) {
      Alert.alert(
        "Invalid link",
        "Could not find a user ID in that link. Make sure you copied the full profile URL.",
      );
      return;
    }
    navigation.navigate("UserProfile", { userId, access, plaqueId });
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    const { userId, access, plaqueId } = parseProfileLink(data);
    if (!userId) {
      Alert.alert(
        "Unrecognised QR",
        "This QR code doesn't link to a Gone Not Forgotten profile.",
        [{ text: "Try again", onPress: () => setScanned(false) }],
      );
      return;
    }
    navigation.navigate("UserProfile", { userId, access, plaqueId });
  };

  const openManualProfile = () => {
    const { userId, access, plaqueId } = parseProfileLink(manualValue);
    navigateToProfile(userId, access, plaqueId);
  };

  // ── Shared manual-entry section ───────────────────────────────────────────
  const ManualEntry = () => (
    <View style={styles.manualSection}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or paste a link</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Paste profile link or user ID"
          placeholderTextColor={Colors.ink300}
          value={manualValue}
          onChangeText={setManualValue}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={openManualProfile}
        />
        <TouchableOpacity
          style={[styles.goBtn, !manualValue.trim() && styles.goBtnDisabled]}
          onPress={openManualProfile}
          disabled={!manualValue.trim()}
        >
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Web: no camera, just manual entry ────────────────────────────────────
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
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
          <Text style={styles.heading}>View a Profile</Text>
        </View>
        <Text style={styles.hint}>
          Paste a profile link below to open that user's profile.
        </Text>
        <ManualEntry />
      </View>
    );
  }

  // ── Permission pending ────────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.centreText}>Requesting camera permission…</Text>
      </View>
    );
  }

  // ── Permission denied — show manual entry only ────────────────────────────
  if (hasPermission === false) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.topBar}>
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
          <Text style={styles.heading}>Scan Profile QR</Text>
        </View>
        <View style={styles.noCameraBox}>
          <MaterialCommunityIcons
            name="camera-off"
            size={48}
            color={Colors.ink300}
          />
          <Text style={styles.noCameraTitle}>Camera access needed</Text>
          <Text style={styles.noCameraText}>
            Enable camera permission in your device settings, or paste a profile
            link below.
          </Text>
        </View>
        <ManualEntry />
      </KeyboardAvoidingView>
    );
  }

  // ── Camera scanner + manual entry ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.topBar}>
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
        <Text style={styles.heading}>Scan Profile QR</Text>
      </View>

      {/* Camera */}
      <View style={styles.scannerBox}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        {/* Corner brackets for framing */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {scanned && (
          <View style={styles.scannedOverlay}>
            <TouchableOpacity
              style={styles.scanAgainBtn}
              onPress={() => setScanned(false)}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={18}
                color="#fff"
              />
              <Text style={styles.scanAgainText}>Tap to scan again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.cameraHint}>
        Point your camera at a Gone Not Forgotten QR code
      </Text>

      {/* Manual entry always available below camera */}
      <ManualEntry />
    </KeyboardAvoidingView>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#6cab90";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    backgroundColor: Colors.cream,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.ink700,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.ink700,
  },
  hint: {
    color: Colors.ink500,
    marginHorizontal: 20,
    marginBottom: 14,
    lineHeight: 20,
    fontSize: 14,
  },

  // ── Camera box ─────────────────────────────────────────────────────────────
  scannerBox: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  cameraHint: {
    textAlign: "center",
    color: Colors.ink400,
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 20,
  },

  // Scanned overlay
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.green700,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
  },
  scanAgainText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // Corner brackets
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: {
    top: 16,
    left: 16,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 16,
    right: 16,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 16,
    left: 16,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 16,
    right: 16,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },

  // ── Manual entry section ───────────────────────────────────────────────────
  manualSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ink100,
  },
  dividerText: {
    color: Colors.ink400,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.ink100,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.white,
    color: Colors.ink700,
  },
  goBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.green700,
    alignItems: "center",
    justifyContent: "center",
  },
  goBtnDisabled: {
    opacity: 0.4,
  },

  // ── No-camera / error states ───────────────────────────────────────────────
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cream,
    padding: 24,
  },
  centreText: {
    color: Colors.ink500,
    textAlign: "center",
    fontSize: 14,
  },
  noCameraBox: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 32,
    gap: 10,
  },
  noCameraTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink700,
    marginTop: 8,
  },
  noCameraText: {
    fontSize: 14,
    color: Colors.ink500,
    textAlign: "center",
    lineHeight: 20,
  },
});
