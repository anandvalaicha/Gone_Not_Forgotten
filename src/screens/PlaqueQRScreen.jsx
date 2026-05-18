import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Share,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
// expo-file-system v19 split the API. Use legacy for writeAsStringAsync /
// cacheDirectory / EncodingType.
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import QRCode from "react-native-qrcode-svg";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { isSupabaseConfigured } from "../config/supabase";
import { memorialService, authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

export default function PlaqueQRScreen({ navigation }) {
  const qrRef = useRef(null);

  // selected media
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);
  const [description, setDescription] = useState("");

  // memory picker modal
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [memoryMediaType, setMemoryMediaType] = useState("photos");
  const [memorials, setMemorials] = useState([]);
  const [loadingMemorials, setLoadingMemorials] = useState(false);

  // QR generated state
  const [qrGenerated, setQrGenerated] = useState(false);
  const [plaqueId] = useState(() => `plaque-${Date.now()}`);

  const user = authService.getCurrentUser();
  const userId = user?.uid;
  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0]?.replace(/[._]/g, " ") ||
    "Plaque Memorial";

  // Embed userId so the scanner can load the right person's profile.
  // Falls back to a plaque-only URL if the user somehow isn't loaded yet.
  const qrValue = userId
    ? `https://gonenotforgotten.app/profile/${userId}?plaque=${plaqueId}`
    : `https://gonenotforgotten.app/plaque/${plaqueId}`;

  // Load user memorials for the picker
  const loadMemorials = async () => {
    setLoadingMemorials(true);
    if (isSupabaseConfigured && userId) {
      const result = await memorialService.getUserMemorials(userId);
      if (result.success) {
        setMemorials(result.memorials);
      }
    }
    setLoadingMemorials(false);
  };

  useEffect(() => {
    loadMemorials();
  }, []);

  // ── Select from Memory ──
  const openMemoryPicker = (mediaType) => {
    setMemoryMediaType(mediaType);
    setMemoryModalVisible(true);
  };

  const selectFromMemory = (uri) => {
    if (memoryMediaType === "photos") {
      if (!photos.includes(uri)) setPhotos((p) => [...p, uri]);
    } else if (memoryMediaType === "videos") {
      if (!videos.includes(uri)) setVideos((v) => [...v, uri]);
    } else {
      if (!audios.includes(uri)) setAudios((a) => [...a, uri]);
    }
  };

  // ── Upload New ──
  const uploadNewPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.7,
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setPhotos((p) => [...p, ...result.assets.map((a) => a.uri)]);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick photo");
    }
  };

  const uploadNewVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setVideos((v) => [...v, result.assets[0].uri]);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick video");
    }
  };

  const uploadNewAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri || result.uri;
      if (uri) setAudios((a) => [...a, uri]);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick audio");
    }
  };

  // ── Remove helpers ──
  const removePhoto = (idx) => setPhotos((p) => p.filter((_, i) => i !== idx));
  const removeVideo = (idx) => setVideos((v) => v.filter((_, i) => i !== idx));
  const removeAudio = (idx) => setAudios((a) => a.filter((_, i) => i !== idx));

  // ── Generate QR ──
  const handleGenerate = async () => {
    if (
      !photos.length &&
      !videos.length &&
      !audios.length &&
      !description.trim()
    ) {
      Alert.alert("Empty", "Please add some media or write something first.");
      return;
    }

    const plaqueData = {
      id: plaqueId,
      description: description.trim(),
      photos,
      videos,
      audios,
    };

    // Save to AsyncStorage first — always works on same device
    try {
      await AsyncStorage.setItem(`plaque_${plaqueId}`, JSON.stringify(plaqueData));
    } catch (_) {}

    // Save to Supabase so other devices can scan and see the content
    if (isSupabaseConfigured && userId) {
      const result = await memorialService.savePlaquePost(plaqueId, userId, plaqueData);
      if (!result.success) {
        Alert.alert(
          "Heads up",
          "Your QR was created but couldn't be saved to the cloud. It will only work on this device.",
        );
      }
    }

    setQrGenerated(true);
  };

  // ── Download / Share QR ──
  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to save photos to your gallery.",
        );
        return;
      }
      qrRef.current.toDataURL(async (dataURL) => {
        try {
          const fileUri =
            FileSystem.cacheDirectory + `plaque-qr-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(fileUri, dataURL, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await MediaLibrary.saveToLibraryAsync(fileUri);
          Alert.alert("Saved!", "QR code has been saved to your gallery.");
        } catch (err) {
          Alert.alert("Error", "Failed to save QR code.");
        }
      });
    } catch (err) {
      Alert.alert("Error", "Failed to save QR code.");
    }
  };

  // ── Collect available media items for the picker ──
  const getAvailableMedia = () => {
    const items = [];
    memorials.forEach((m) => {
      const arr = m[memoryMediaType] || [];
      arr.forEach((uri) => items.push({ uri, memorialTitle: m.title }));
    });
    return items;
  };

  // ── Media label helper ──
  const fileName = (uri) => {
    const parts = uri.split("/");
    const name = parts[parts.length - 1]?.split("?")[0];
    return name?.length > 30 ? name.substring(0, 30) + "…" : name || "file";
  };

  const mediaSummary = `${photos.length} photo${photos.length !== 1 ? "s" : ""} · ${videos.length} video${videos.length !== 1 ? "s" : ""} · ${audios.length} audio${audios.length !== 1 ? "s" : ""}`;

  // ─────────── QR Result View ───────────
  if (qrGenerated) {
    return (
      <View style={styles.container}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setQrGenerated(false)}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.resultScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.titleArea}>
            <AppLogo size={36} tintColor="#fff" />
            <Text style={styles.title}>Plaque QR Code</Text>
            <Text style={styles.subtitle}>Share your curated memorial</Text>
          </View>

          {/* QR Card */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={styles.glowRing}>
              <View style={styles.qrCard}>
                <Text style={styles.qrName}>{displayName}</Text>
                <View style={styles.divider} />
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={qrValue}
                    size={200}
                    color="#1A1A1A"
                    backgroundColor="#FFFFFF"
                    getRef={(ref) => (qrRef.current = ref)}
                  />
                  {/* Logo embedded in center */}
                  <View style={styles.avatarOverlay}>
                    <AppLogo size={28} />
                  </View>
                </View>
                <View style={styles.urlRow}>
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={14}
                    color={Colors.green700}
                  />
                  <Text style={styles.urlText} numberOfLines={1}>
                    {mediaSummary}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Content Preview ── */}
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <MaterialCommunityIcons
                name="eye-outline"
                size={16}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.previewHeaderText}>What they will see</Text>
            </View>

            {/* Description */}
            {description.trim() ? (
              <View style={styles.previewDescBox}>
                <Text style={styles.previewDescLabel}>Message</Text>
                <Text style={styles.previewDesc}>{description.trim()}</Text>
              </View>
            ) : null}

            {/* Photos */}
            {photos.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionLabel}>
                  Photos ({photos.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {photos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={styles.previewThumb}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionLabel}>
                  Videos ({videos.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 8 }}
                >
                  {videos.map((uri, i) => (
                    <View key={i} style={styles.previewVideoThumb}>
                      <MaterialCommunityIcons
                        name="play-circle"
                        size={32}
                        color="rgba(255,255,255,0.85)"
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Audio */}
            {audios.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionLabel}>
                  Audio ({audios.length})
                </Text>
                {audios.map((uri, i) => (
                  <View key={i} style={styles.previewAudioRow}>
                    <MaterialCommunityIcons
                      name="music-note"
                      size={16}
                      color={Colors.green300}
                    />
                    <Text style={styles.previewAudioName} numberOfLines={1}>
                      {fileName(uri)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Bottom buttons */}
          <View style={styles.bottomBtns}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleDownloadQR}
            >
              <MaterialCommunityIcons name="download" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>Download QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() =>
                Share.share({
                  message: `View this Plaque memorial: ${qrValue}`,
                  url: qrValue,
                }).catch(() => {})
              }
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={18}
                color="#fff"
              />
              <Text style={styles.manageBtnText}>Share a link</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    );
  }

  // ─────────── Main Builder View (dark theme matching QRCodeScreen) ───────────
  return (
    <View style={styles.container}>
      {/* Ambient glow blobs */}
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
        <AppLogo size={36} tintColor="#fff" />
        <Text style={styles.title}>Plaque QR Code</Text>
        <Text style={styles.subtitle}>
          Select media & write, then generate a QR
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.builderContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Write about them */}
        <View style={styles.builderSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.builderSectionTitle}>Write about them</Text>
            {description.length > 0 && (
              <Text style={styles.charCount}>{description.length} chars</Text>
            )}
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Share your thoughts, memories, or a tribute…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* Photos */}
        <View style={styles.builderSection}>
          <Text style={styles.builderSectionTitle}>Photos</Text>
          <View style={styles.mediaBtnRow}>
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={() => openMemoryPicker("photos")}
            >
              <MaterialCommunityIcons
                name="image-album"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>From Memory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={uploadNewPhoto}>
              <MaterialCommunityIcons
                name="upload"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>Upload New</Text>
            </TouchableOpacity>
          </View>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mediaRow}
            >
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removePhoto(idx)}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyHint}>No photos selected yet</Text>
          )}
        </View>

        {/* Videos */}
        <View style={styles.builderSection}>
          <Text style={styles.builderSectionTitle}>Videos</Text>
          <View style={styles.mediaBtnRow}>
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={() => openMemoryPicker("videos")}
            >
              <MaterialCommunityIcons
                name="video-outline"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>From Memory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={uploadNewVideo}>
              <MaterialCommunityIcons
                name="upload"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>Upload New</Text>
            </TouchableOpacity>
          </View>
          {videos.length > 0 ? (
            <View style={styles.fileList}>
              {videos.map((uri, idx) => (
                <View key={idx} style={styles.fileRow}>
                  <MaterialCommunityIcons
                    name="video"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {fileName(uri)}
                  </Text>
                  <TouchableOpacity onPress={() => removeVideo(idx)}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No videos selected yet</Text>
          )}
        </View>

        {/* Audio */}
        <View style={styles.builderSection}>
          <Text style={styles.builderSectionTitle}>Audio</Text>
          <View style={styles.mediaBtnRow}>
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={() => openMemoryPicker("audios")}
            >
              <MaterialCommunityIcons
                name="music-note"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>From Memory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={uploadNewAudio}>
              <MaterialCommunityIcons
                name="upload"
                size={18}
                color={Colors.green700}
              />
              <Text style={styles.sourceBtnText}>Upload New</Text>
            </TouchableOpacity>
          </View>
          {audios.length > 0 ? (
            <View style={styles.fileList}>
              {audios.map((uri, idx) => (
                <View key={idx} style={styles.fileRow}>
                  <MaterialCommunityIcons
                    name="music-note"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {fileName(uri)}
                  </Text>
                  <TouchableOpacity onPress={() => removeAudio(idx)}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No audio selected yet</Text>
          )}
        </View>

        {/* Generate QR button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleGenerate}>
          <MaterialCommunityIcons name="qrcode" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Generate QR Code</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Memory Picker Modal ── */}
      <Modal
        visible={memoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMemoryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Select{" "}
              {memoryMediaType === "photos"
                ? "Photos"
                : memoryMediaType === "videos"
                  ? "Videos"
                  : "Audio"}{" "}
              from Memory
            </Text>
            <Text style={styles.modalHint}>
              Tap to select items from your saved memories.
            </Text>

            {loadingMemorials ? (
              <ActivityIndicator
                size="large"
                color={Colors.green700}
                style={{ marginTop: 20 }}
              />
            ) : (
              <FlatList
                data={getAvailableMedia()}
                keyExtractor={(item, idx) => `${item.uri}-${idx}`}
                ListEmptyComponent={
                  <Text style={styles.emptyModalText}>
                    No {memoryMediaType} found in your memories.
                  </Text>
                }
                renderItem={({ item }) => {
                  const isSelected =
                    memoryMediaType === "photos"
                      ? photos.includes(item.uri)
                      : memoryMediaType === "videos"
                        ? videos.includes(item.uri)
                        : audios.includes(item.uri);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.memoryItem,
                        isSelected && styles.memoryItemSelected,
                      ]}
                      onPress={() => selectFromMemory(item.uri)}
                      activeOpacity={0.7}
                    >
                      {memoryMediaType === "photos" ? (
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.memoryThumb}
                        />
                      ) : (
                        <View style={styles.memoryFileIcon}>
                          <MaterialCommunityIcons
                            name={
                              memoryMediaType === "videos"
                                ? "video"
                                : "music-note"
                            }
                            size={28}
                            color={Colors.green700}
                          />
                        </View>
                      )}
                      <View style={styles.memoryInfo}>
                        <Text style={styles.memoryLabel} numberOfLines={1}>
                          {fileName(item.uri)}
                        </Text>
                        <Text style={styles.memoryMemorial}>
                          {item.memorialTitle}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color={Colors.green700}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setMemoryModalVisible(false)}
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
  // ── Container (dark bg like QRCodeScreen) ──
  container: {
    flex: 1,
    backgroundColor: "#3D3D3D",
  },

  // ── Ambient glow blobs ──
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

  // ── Back button ──
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

  // ── Title area ──
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

  // ── Glow ring around QR card ──
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

  // ── Center area for QR ──
  centerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  // ── White QR card ──
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
  qrWrapper: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarOverlay: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
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

  // ── Access note ──
  accessNote: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  accessNoteText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
  },

  // ── Bottom buttons (pill style) ──
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

  // ── QR result scroll ──
  resultScroll: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },

  // ── Content preview card ──
  previewCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 18,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  previewHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewDescBox: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  previewDescLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.green300,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewDesc: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  previewSection: {
    marginBottom: 14,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.green300,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  previewVideoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  previewAudioName: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },

  // ── Builder scroll content ──
  builderContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  // ── Builder sections (glass-like dark cards) ──
  builderSection: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  builderSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  charCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
  },

  // ── Text area (dark style) ──
  textArea: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    minHeight: 110,
  },

  // ── Source buttons (dark style) ──
  mediaBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.4)",
  },
  sourceBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.green700,
  },

  // ── Media thumbnails ──
  mediaRow: {
    marginTop: 4,
  },
  thumbWrap: {
    marginRight: 10,
    position: "relative",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#3D3D3D",
    borderRadius: 10,
  },

  // ── File list (videos / audio) ──
  fileList: {
    gap: 8,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },

  // ── Empty hint ──
  emptyHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    paddingVertical: 6,
  },

  // ── Modal (matches QRCodeScreen modal) ──
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
    maxHeight: "70%",
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
  emptyModalText: {
    textAlign: "center",
    color: Colors.ink300,
    marginTop: 30,
    fontSize: 14,
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

  // ── Memory picker items ──
  memoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E0D9",
  },
  memoryItemSelected: {
    backgroundColor: "#E8E3DC",
  },
  memoryThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.ink100,
  },
  memoryFileIcon: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.ink100,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryInfo: {
    flex: 1,
  },
  memoryLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 4,
  },
  memoryMemorial: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink500,
  },
});
