import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { isFirebaseConfigured } from "../config/firebase";
import { memorialService, authService, storageService } from "../services";
import { Colors } from "../theme/colors";

const DEMO_MEMORIALS = [
  {
    id: "demo-memorial-1",
    title: "Eleanor Grace",
    years: "1948 — 2023",
    description:
      "Today was perfect. Surrounded by the people I love, laughing, reminiscing, and just soaking it all in. I've never felt more grateful—for the years behind me and the moments that brought me here.\n\nLife has been good, and today was a beautiful reminder of that.",
    visibility: "public",
    createdAt: new Date("2023-12-01"),
    photos: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80",
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=900&q=80",
      "https://images.unsplash.com/photo-1511895426328-dc8714191011?w=900&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80",
    ],
    videos: [],
    audios: [],
  },
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function HomeScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memorials, setMemorials] = useState(
    isFirebaseConfigured ? [] : DEMO_MEMORIALS,
  );
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [draftVideos, setDraftVideos] = useState([]);
  const [draftAudios, setDraftAudios] = useState([]);

  const user = authService.getCurrentUser();
  const userId = user?.uid;
  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0]?.replace(/[._]/g, " ") ||
    "there";

  const filteredMemorials = useMemo(() => {
    let filtered = memorials;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = memorials.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q),
      );
    }
    // Sort the filtered results
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
    return filtered;
  }, [memorials, searchQuery, sortBy]);

  const loadMemorials = async () => {
    if (!isFirebaseConfigured) {
      setMemorials((cur) => (cur.length > 0 ? cur : DEMO_MEMORIALS));
      return;
    }
    if (!userId) return;
    setLoading(true);
    const result = await memorialService.getUserMemorials(userId);
    if (result.success) {
      setMemorials(result.memorials);
    } else {
      Alert.alert("Error", result.error || "Could not load memorials");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMemorials();
  }, [userId]);

  const pickDraftMedia = async (mediaType) => {
    try {
      if (mediaType === "audios") {
        const result = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
        });
        if (result.type !== "success") return;
        setDraftAudios((cur) => [...cur, result.uri]);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            mediaType === "photos"
              ? ImagePicker.MediaTypeOptions.Images
              : ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 0.7,
          allowsMultipleSelection: true,
        });
        if (result.canceled || !result.assets?.length) return;
        const uris = result.assets.map((a) => a.uri);
        if (mediaType === "photos") {
          setDraftPhotos((cur) => [...cur, ...uris]);
        } else {
          setDraftVideos((cur) => [...cur, ...uris]);
        }
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Could not pick file");
    }
  };

  const removeDraftPhoto = (idx) =>
    setDraftPhotos((cur) => cur.filter((_, i) => i !== idx));
  const removeDraftVideo = (idx) =>
    setDraftVideos((cur) => cur.filter((_, i) => i !== idx));
  const removeDraftAudio = (idx) =>
    setDraftAudios((cur) => cur.filter((_, i) => i !== idx));

  const resetModal = () => {
    setTitle("");
    setDescription("");
    setDraftPhotos([]);
    setDraftVideos([]);
    setDraftAudios([]);
    setShowCreateModal(false);
  };

  const createMemorial = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Validation", "Please fill in name and description.");
      return;
    }
    if (!isFirebaseConfigured) {
      const local = {
        id: `local-${Date.now()}`,
        title,
        years: "Forever remembered",
        description,
        visibility: "public",
        createdAt: new Date(),
        photos: draftPhotos,
        videos: draftVideos,
        audios: draftAudios,
      };
      setMemorials((cur) => [local, ...cur]);
      resetModal();
      return;
    }
    setLoading(true);
    const result = await memorialService.createMemorial(userId, {
      title,
      description,
      visibility: "public",
      photos: draftPhotos,
      videos: draftVideos,
      audios: draftAudios,
    });
    if (result.success) {
      resetModal();
      await loadMemorials();
    } else {
      Alert.alert("Error", result.error || "Could not create memorial");
    }
    setLoading(false);
  };

  const uploadMedia = async (memorialId, mediaType) => {
    try {
      let pickerResult;
      if (mediaType === "audios") {
        pickerResult = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
        });
        if (pickerResult.type !== "success") return;
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            mediaType === "photos"
              ? ImagePicker.MediaTypeOptions.Images
              : ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 0.7,
        });
        if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;
        pickerResult = {
          uri: pickerResult.assets[0].uri,
          name: pickerResult.assets[0].uri.split("/").pop(),
        };
      }
      const fileUri = pickerResult.uri;

      // Demo mode — Firebase not connected, use local URI directly
      if (!isFirebaseConfigured) {
        setMemorials((cur) =>
          cur.map((m) =>
            m.id === memorialId
              ? { ...m, [mediaType]: [...(m[mediaType] || []), fileUri] }
              : m,
          ),
        );
        return;
      }

      const extension = fileUri.split(".").pop().split("?")[0];
      const fileName = `${memorialId}-${Date.now()}.${extension}`;
      setLoading(true);
      const uploadResult = await storageService.uploadFile(
        fileUri,
        fileName,
        `memorials/${memorialId}`,
      );
      if (!uploadResult.success) {
        Alert.alert(
          "Upload failed",
          uploadResult.error || "Could not upload media",
        );
        return;
      }
      const appendResult = await memorialService.appendMedia(
        memorialId,
        mediaType,
        uploadResult.url,
      );
      if (!appendResult.success) {
        Alert.alert(
          "Update failed",
          appendResult.error || "Could not update memorial",
        );
      } else {
        await loadMemorials();
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Could not upload media");
    } finally {
      setLoading(false);
    }
  };

  const renderMemoryCard = ({ item }) => {
    const raw = item.createdAt;
    const date =
      raw instanceof Date ? raw : raw?.toDate ? raw.toDate() : new Date();
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    const fullDate = `${month} ${day}, ${date.getFullYear()}`;

    return (
      <TouchableOpacity
        style={styles.memoryCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("Detail", { memorialId: item.id })}
      >
        <View style={styles.memoryCardRow}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeDay}>{getOrdinal(day)}</Text>
            <Text style={styles.dateBadgeMonth}>{month}</Text>
          </View>

          <View style={styles.memoryCardContent}>
            <Text style={styles.memoryDateText}>{fullDate}</Text>
            <Text style={styles.memoryTitle}>{item.title}</Text>

            {item.photos?.length > 0 && (
              <View style={styles.photoGrid}>
                {item.photos.slice(0, 4).map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={[
                      styles.photoItem,
                      item.photos.length === 1 && styles.photoItemSingle,
                      item.photos.length === 3 &&
                        idx === 2 &&
                        styles.photoItemWide,
                    ]}
                  />
                ))}
              </View>
            )}

            <Text style={styles.memoryDescription} numberOfLines={3}>
              {item.description}
            </Text>

            <View style={styles.mediaActions}>
              <TouchableOpacity
                style={styles.mediaActionBtn}
                onPress={() => uploadMedia(item.id, "photos")}
                disabled={loading}
              >
                <Text style={styles.mediaActionText}>+ Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mediaActionBtn}
                onPress={() => uploadMedia(item.id, "videos")}
                disabled={loading}
              >
                <Text style={styles.mediaActionText}>+ Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mediaActionBtn}
                onPress={() => uploadMedia(item.id, "audios")}
                disabled={loading}
              >
                <Text style={styles.mediaActionText}>+ Audio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeLabel}>Welcome back</Text>
          <Text style={styles.welcomeName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {displayName[0]?.toUpperCase() || "U"}
          </Text>
        </View>
      </View>

      {/* Action Grid */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.actionIconPrimary}>+</Text>
          <Text style={styles.actionLabelPrimary}>Add memory</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate("Profile")}
        >
          <Text style={styles.actionIcon}>◉</Text>
          <Text style={styles.actionLabel}>Your profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate("ScanQR")}
        >
          <Text style={styles.actionIcon}>⊡</Text>
          <Text style={styles.actionLabel}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate("GenerateQR")}
        >
          <Text style={styles.actionIcon}>◈</Text>
          <Text style={styles.actionLabel}>Generate QR</Text>
        </TouchableOpacity>
      </View>

      {/* Memories section header */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Your Memories</Text>
        <TouchableOpacity
          onPress={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
        >
          <Text style={styles.filterIcon}>
            {sortBy === "newest" ? "↓" : "↑"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={Colors.ink300}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          underlineColorAndroid="transparent"
          selectionColor={Colors.green700}
          caretColor={Colors.green700}
          keyboardAppearance="light"
        />
      </View>

      {/* Feed */}
      {loading && memorials.length === 0 ? (
        <ActivityIndicator
          size="large"
          color={Colors.green700}
          style={{ marginTop: 30 }}
        />
      ) : (
        <FlatList
          data={filteredMemorials}
          keyExtractor={(item) => item.id}
          renderItem={renderMemoryCard}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>
                Tap "Add memory" to start the story.
              </Text>
            </View>
          }
        />
      )}

      {/* Create Memory Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={resetModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={resetModal}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Add a Memory</Text>

              <TextInput
                style={styles.input}
                placeholder="Person's name"
                placeholderTextColor={Colors.ink300}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Share a memory..."
                placeholderTextColor={Colors.ink300}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Media pick buttons */}
              <View style={styles.mediaPickRow}>
                <TouchableOpacity
                  style={styles.mediaPickBtn}
                  onPress={() => pickDraftMedia("photos")}
                >
                  <Text style={styles.mediaPickIcon}>🖼</Text>
                  <Text style={styles.mediaPickLabel}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaPickBtn}
                  onPress={() => pickDraftMedia("videos")}
                >
                  <Text style={styles.mediaPickIcon}>🎥</Text>
                  <Text style={styles.mediaPickLabel}>Video</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaPickBtn}
                  onPress={() => pickDraftMedia("audios")}
                >
                  <Text style={styles.mediaPickIcon}>🎵</Text>
                  <Text style={styles.mediaPickLabel}>Audio</Text>
                </TouchableOpacity>
              </View>

              {/* Photo previews */}
              {draftPhotos.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewLabel}>
                    Photos ({draftPhotos.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {draftPhotos.map((uri, idx) => (
                      <View key={idx} style={styles.previewThumbWrap}>
                        <Image source={{ uri }} style={styles.previewThumb} />
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeDraftPhoto(idx)}
                        >
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Video previews */}
              {draftVideos.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewLabel}>
                    Videos ({draftVideos.length})
                  </Text>
                  {draftVideos.map((uri, idx) => (
                    <View key={idx} style={styles.fileRow}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {uri.split("/").pop()}
                      </Text>
                      <TouchableOpacity onPress={() => removeDraftVideo(idx)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Audio previews */}
              {draftAudios.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewLabel}>
                    Audio ({draftAudios.length})
                  </Text>
                  {draftAudios.map((uri, idx) => (
                    <View key={idx} style={styles.fileRow}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {uri.split("/").pop()}
                      </Text>
                      <TouchableOpacity onPress={() => removeDraftAudio(idx)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={createMemorial}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Saving..." : "Save Memory"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetModal}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  welcomeLabel: {
    fontSize: 13,
    color: Colors.ink500,
    marginBottom: 2,
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.ink700,
    maxWidth: 260,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.green300,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "700",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 22,
  },
  actionBtn: {
    width: "47%",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.green700,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.ink100,
  },
  actionIconPrimary: {
    fontSize: 20,
    color: Colors.white,
    fontWeight: "700",
    lineHeight: 22,
  },
  actionLabelPrimary: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 14,
  },
  actionIcon: {
    fontSize: 16,
    color: Colors.ink700,
    lineHeight: 20,
  },
  actionLabel: {
    color: Colors.ink700,
    fontWeight: "600",
    fontSize: 14,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink700,
  },
  filterIcon: {
    fontSize: 20,
    color: Colors.ink500,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  searchIcon: {
    fontSize: 18,
    color: Colors.ink300,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.ink700,
    backgroundColor: Colors.white,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  feedList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  memoryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.ink100,
    overflow: "hidden",
  },
  memoryCardRow: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  dateBadge: {
    width: 44,
    backgroundColor: Colors.green700,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  dateBadgeDay: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  dateBadgeMonth: {
    color: Colors.green100,
    fontSize: 11,
    marginTop: 2,
  },
  memoryCardContent: {
    flex: 1,
  },
  memoryDateText: {
    fontSize: 12,
    color: Colors.ink500,
    marginBottom: 3,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 10,
  },
  photoItem: {
    width: "49%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: Colors.ink100,
  },
  photoItemSingle: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  photoItemWide: {
    width: "100%",
    aspectRatio: 2,
  },
  memoryDescription: {
    fontSize: 14,
    color: Colors.ink500,
    lineHeight: 20,
    marginBottom: 10,
  },
  mediaActions: {
    flexDirection: "row",
    gap: 6,
  },
  mediaActionBtn: {
    backgroundColor: Colors.ink100,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  mediaActionText: {
    fontSize: 12,
    color: Colors.green700,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.ink500,
    textAlign: "center",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 18,
    paddingTop: 12,
    maxHeight: "90%",
    width: "100%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink100,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: Colors.white,
    marginBottom: 12,
    color: Colors.ink700,
  },
  textArea: {
    height: 110,
  },
  button: {
    backgroundColor: Colors.green700,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: {
    color: Colors.ink500,
    fontSize: 15,
  },

  // Modal scroll
  modalScroll: {
    flex: 1,
    maxHeight: "90%",
  },

  // Media pick buttons
  mediaPickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  mediaPickBtn: {
    flex: 1,
    backgroundColor: Colors.ink100,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  mediaPickIcon: {
    fontSize: 22,
  },
  mediaPickLabel: {
    fontSize: 12,
    color: Colors.ink700,
    fontWeight: "600",
  },

  // Previews
  previewSection: {
    marginBottom: 14,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 8,
  },
  previewThumbWrap: {
    marginRight: 8,
    position: "relative",
  },
  previewThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: Colors.ink100,
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  removeBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink700,
    marginRight: 10,
  },
});
