import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { Camera } from "expo-camera";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Colors } from "../theme/colors";

export default function QRScannerScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    const request = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };
    request();
  }, []);

  const parseProfileLink = (raw) => {
    const result = { userId: null, access: null };
    try {
      if (raw.includes("/profile/")) {
        const parts = raw.split("/profile/");
        const tail = parts.pop();
        const [idPart, queryPart] = tail.split("?");
        result.userId = idPart;
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const accessParam = params.get("access");
          if (accessParam) {
            result.access = accessParam.split(",").filter(Boolean);
          }
        }
      } else if (raw.includes("/memorial/")) {
        const parts = raw.split("/memorial/");
        result.userId = parts.pop();
      } else {
        result.userId = raw;
      }
    } catch (error) {
      return result;
    }
    return result;
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    try {
      const { userId, access } = parseProfileLink(data);
      if (!userId) throw new Error("No user ID found");
      navigation.navigate("UserProfile", { userId, access });
    } catch (error) {
      Alert.alert(
        "Invalid QR Code",
        "Could not parse profile link from QR code.",
      );
      setScanned(false);
    }
  };

  const openManualProfile = () => {
    const raw = manualValue.trim();
    const { userId, access } = parseProfileLink(raw);

    if (!userId) {
      Alert.alert("Validation", "Enter a user ID or profile link.");
      return;
    }
    navigation.navigate("UserProfile", { userId, access });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.centreText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color={Colors.ink700}
            />
          </TouchableOpacity>
          <Text style={styles.heading}>Scan Profile QR</Text>
        </View>
        <Text style={styles.hint}>
          On web, paste a profile ID or QR link to open the user's profile page.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter profile ID or link"
          placeholderTextColor={Colors.ink300}
          value={manualValue}
          onChangeText={setManualValue}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.button} onPress={openManualProfile}>
          <Text style={styles.buttonText}>Open Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.centreText}>
          No camera access. Please enable permission in your device settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={Colors.ink700}
          />
        </TouchableOpacity>
        <Text style={styles.heading}>Scan Profile QR</Text>
      </View>
      <View style={styles.scannerBox}>
        <Camera
          style={StyleSheet.absoluteFillObject}
          type={Camera.Constants.Type.back}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: ["qr"],
          }}
        />
      </View>
      {scanned && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.buttonText}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 64,
    backgroundColor: Colors.cream,
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 14,
  },
  hint: {
    color: Colors.ink500,
    marginBottom: 14,
    lineHeight: 20,
    fontSize: 14,
  },
  scannerBox: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.ink100,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
    color: Colors.ink700,
  },
  button: {
    marginTop: 14,
    backgroundColor: Colors.green700,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
