import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import VideoPlayerModal from "../components/VideoPlayerModal";
import { memorialService, storageService } from "../services";
import { isSupabaseConfigured } from "../config/supabase";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";
import StatusBanner from "../components/StatusBanner";

function AudioPlayer({ uri }) {
  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      const atEnd =
        status.currentTime >= (status.duration || 0) - 0.1 &&
        status.duration > 0;
      if (atEnd) player.seekTo(0);
      player.play();
    }
  };

  const positionMs = (status.currentTime || 0) * 1000;
  const durationMs = (status.duration || 0) * 1000;
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const fmt = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Fixed natural waveform heights (0–1 scale)
  const WAVE = [
    0.3, 0.6, 0.9, 0.5, 1.0, 0.7, 0.4, 0.8, 0.6, 1.0, 0.5, 0.8, 0.9, 0.4, 0.7,
    0.9, 0.6, 1.0, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.5, 0.8, 1.0, 0.5, 0.7, 0.4,
  ];

  const displayTime =
    positionMs > 0
      ? fmt(positionMs)
      : durationMs > 0
        ? fmt(durationMs)
        : "0:00";

  return (
    <View style={audioStyles.bubble}>
      <TouchableOpacity style={audioStyles.playBtn} onPress={toggle}>
        <MaterialCommunityIcons
          name={status.playing ? "pause" : "play"}
          size={17}
          color="#fff"
          style={{ marginLeft: status.playing ? 0 : 2 }}
        />
      </TouchableOpacity>
      <View style={audioStyles.waveRow}>
        {WAVE.map((h, i) => (
          <View
            key={i}
            style={[
              audioStyles.bar,
              { height: Math.max(3, h * 26) },
              i / WAVE.length <= progress
                ? audioStyles.barFilled
                : audioStyles.barEmpty,
            ]}
          />
        ))}
      </View>
      <Text style={audioStyles.duration}>{displayTime}</Text>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF5F1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.green100,
    marginBottom: 10,
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  waveRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    gap: 3,
    overflow: "hidden",
  },
  bar: {
    width: 3,
    borderRadius: 3,
  },
  barFilled: {
    backgroundColor: Colors.green700,
  },
  barEmpty: {
    backgroundColor: "#A8C8B8",
  },
  duration: {
    fontSize: 11,
    color: Colors.ink700,
    fontWeight: "600",
    minWidth: 36,
    textAlign: "right",
  },
});

const TABS = ["Memories", "Gallery", "Videos", "Audio"];

export default function MemorialDetailScreen({ route, navigation }) {
  const { memorialId } = route.params || {};
  const [memorial, setMemorial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Memories");
  const [videoModal, setVideoModal] = useState({ visible: false, uri: null });
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPhotos, setEditPhotos] = useState([]);
  const [editVideos, setEditVideos] = useState([]);
  const [editAudios, setEditAudios] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editBanner, setEditBanner] = useState(null);

  // ── Pick new media inside the edit modal ───────────────────────────────────
  const pickEditMedia = async (mediaType) => {
    try {
      if (mediaType === "audios") {
        const result = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        setEditAudios((cur) => [
          ...cur,
          {
            uri: result.assets[0].uri,
            name: result.assets[0].name,
            isNew: true,
          },
        ]);
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow access to your photo library.",
          );
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: mediaType === "photos" ? "images" : "videos",
          allowsEditing: false,
          quality: 0.8,
          allowsMultipleSelection: true,
        });
        if (result.canceled || !result.assets?.length) return;
        if (mediaType === "photos") {
          setEditPhotos((cur) => [
            ...cur,
            ...result.assets.map((a) => ({ uri: a.uri, isNew: true })),
          ]);
        } else {
          setEditVideos((cur) => [
            ...cur,
            ...result.assets.map((a) => ({ uri: a.uri, isNew: true })),
          ]);
        }
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick file");
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await memorialService.deleteMemorial(memorialId);
    setDeleting(false);
    if (result.success) {
      setDeleteConfirmVisible(false);
      navigation.goBack();
    } else {
      setDeleteConfirmVisible(false);
      Alert.alert("Error", result.error || "Could not delete memory.");
    }
  };

  const handleEdit = () => {
    setMenuVisible(false);
    setEditBanner(null);
    setEditTitle(memorial?.title || "");
    setEditDesc(memorial?.description || "");
    // Wrap existing URLs as { uri, isNew: false } objects
    setEditPhotos(
      (memorial?.photos || []).map((uri) => ({ uri, isNew: false })),
    );
    setEditVideos(
      (memorial?.videos || []).map((uri) => ({ uri, isNew: false })),
    );
    setEditAudios(
      (memorial?.audios || []).map((uri) => ({ uri, isNew: false })),
    );
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setEditBanner({ type: "error", text: "Title cannot be empty." });
      return;
    }
    setEditBanner(null);
    setSaving(true);
    try {
      // Upload any new files first
      const uploadOne = async (item, mediaKind) => {
        if (!item.isNew) return item.uri; // already a cloud URL
        const rawExt = item.uri.split(".").pop().split("?")[0].toLowerCase();
        const ext =
          rawExt.length <= 5
            ? rawExt
            : mediaKind === "photos"
              ? "jpg"
              : mediaKind === "videos"
                ? "mp4"
                : "mp3";
        const fileName = `${mediaKind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        if (!isSupabaseConfigured) return item.uri;
        const res = await storageService.uploadFile(
          item.uri,
          fileName,
          memorialId,
        );
        if (!res.success) {
          console.warn("[editSave] upload failed:", res.error);
          return item.uri; // keep local URI as fallback
        }
        return res.url;
      };

      const [finalPhotos, finalVideos, finalAudios] = await Promise.all([
        Promise.all(editPhotos.map((item) => uploadOne(item, "photos"))),
        Promise.all(editVideos.map((item) => uploadOne(item, "videos"))),
        Promise.all(
          editAudios.map((item) =>
            uploadOne(item.uri ? item : { uri: item, isNew: false }, "audios"),
          ),
        ),
      ]);

      const result = await memorialService.updateMemorial(memorialId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        photos: finalPhotos.filter(Boolean),
        videos: finalVideos.filter(Boolean),
        audios: finalAudios.filter(Boolean),
      });

      if (!result.success) {
        setEditBanner({ type: "error", text: result.error || "Could not save changes. Please try again." });
        return;
      }

      setMemorial((prev) => ({
        ...prev,
        title: editTitle.trim(),
        description: editDesc.trim(),
        photos: finalPhotos.filter(Boolean),
        videos: finalVideos.filter(Boolean),
        audios: finalAudios.filter(Boolean),
      }));
      setEditBanner({ type: "success", text: "Changes saved successfully!" });
      setTimeout(() => setEditModal(false), 1200);
    } catch (e) {
      setEditBanner({ type: "error", text: e.message || "Could not save changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!memorialId) return;
    (async () => {
      setLoading(true);
      const result = await memorialService.getMemorial(memorialId);
      if (result.success) {
        setMemorial(result.memorial);
      }
      setLoading(false);
    })();
  }, [memorialId]);

  // Reload whenever the screen comes back into focus (e.g. after uploading from home)
  useFocusEffect(
    useCallback(() => {
      if (!memorialId) return;
      memorialService.getMemorial(memorialId).then((result) => {
        if (result.success) setMemorial(result.memorial);
      });
    }, [memorialId]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.green700} />
      </View>
    );
  }

  if (!memorial) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Memorial not found.</Text>
      </View>
    );
  }

  const coverPhoto =
    memorial.photos?.[0] ||
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&q=80";

  const renderTabContent = () => {
    switch (activeTab) {
      case "Memories":
        return (
          <View style={styles.tabContent}>
            {memorial.photos?.length > 0 ||
            memorial.videos?.length > 0 ||
            memorial.description ? (
              <View style={styles.memoryPost}>
                {memorial.photos?.length > 0 && (
                  <View style={styles.postPhotoRow}>
                    {memorial.photos.slice(0, 2).map((uri, idx) => (
                      <Image
                        key={idx}
                        source={{ uri }}
                        style={styles.postPhoto}
                      />
                    ))}
                  </View>
                )}
                {memorial.videos?.length > 0 && (
                  <View style={styles.videoThumbRow}>
                    {memorial.videos.slice(0, 3).map((uri, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.videoThumbSmall}
                        activeOpacity={0.85}
                        onPress={() => setVideoModal({ visible: true, uri })}
                      >
                        <View style={styles.videoThumbDark} />
                        <View style={styles.videoPlayOverlay}>
                          <View style={styles.videoPlayCircle}>
                            <MaterialCommunityIcons
                              name="play"
                              size={14}
                              color="#222"
                              style={{ marginLeft: 2 }}
                            />
                          </View>
                        </View>
                        {idx === 2 && memorial.videos.length > 3 && (
                          <View style={styles.videoMoreOverlay}>
                            <Text style={styles.videoMoreText}>
                              +{memorial.videos.length - 2}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.postDescription}>
                  {memorial.description}
                </Text>
              </View>
            ) : (
              <Text style={styles.empty}>No memories added yet.</Text>
            )}
          </View>
        );
      case "Gallery":
        return (
          <View style={styles.tabContent}>
            {memorial.photos?.length > 0 ? (
              <View style={styles.galleryGrid}>
                {memorial.photos.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={styles.galleryPhoto}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No photos yet.</Text>
            )}
          </View>
        );
      case "Videos":
        return (
          <View style={styles.tabContent}>
            {memorial.videos?.length > 0 ? (
              <View style={styles.videoGrid}>
                {memorial.videos.map((uri, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.videoThumb}
                    activeOpacity={0.85}
                    onPress={() => setVideoModal({ visible: true, uri })}
                  >
                    <View style={styles.videoPlaceholder}>
                      <MaterialCommunityIcons
                        name="video-outline"
                        size={36}
                        color="rgba(255,255,255,0.18)"
                      />
                    </View>
                    <View style={styles.videoPlayOverlay}>
                      <View style={styles.videoPlayCircle}>
                        <MaterialCommunityIcons
                          name="play"
                          size={16}
                          color="#222"
                          style={{ marginLeft: 2 }}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No videos yet.</Text>
            )}
          </View>
        );
      case "Audio":
        return (
          <View style={styles.tabContent}>
            {memorial.audios?.length > 0 ? (
              memorial.audios.map((uri, idx) => (
                <AudioPlayer key={`${uri}-${idx}`} uri={uri} />
              ))
            ) : (
              <Text style={styles.empty}>No audio recordings yet.</Text>
            )}
          </View>
        );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top nav */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={Colors.ink700}
          />
        </TouchableOpacity>
        <AppLogo size={32} />
        <View style={{ flex: 1 }} />
        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setMenuVisible(true)}
          >
            <MaterialCommunityIcons
              name="dots-vertical"
              size={20}
              color={Colors.ink700}
            />
          </TouchableOpacity>
        </View>

        {/* Dropdown menu */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          >
            <TouchableOpacity
              style={styles.menuDropdown}
              activeOpacity={1}
              onPress={() => {}}
            >
              <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={18}
                  color={Colors.ink700}
                />
                <Text style={styles.menuItemText}>Edit</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={18}
                  color="#E05252"
                />
                <Text style={[styles.menuItemText, { color: "#E05252" }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarFrame}>
          <Image source={{ uri: coverPhoto }} style={styles.avatarImage} />
        </View>
        <Text style={styles.name}>{memorial.title}</Text>
        <Text style={styles.bio}>{memorial.description}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {renderTabContent()}

      {videoModal.visible && videoModal.uri && (
        <VideoPlayerModal
          uri={videoModal.uri}
          onClose={() => setVideoModal({ visible: false, uri: null })}
        />
      )}

      {/* Edit modal */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.editOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.editSheet}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.editHeader}>
              <Text style={styles.editTitleText}>Edit Memorial</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={Colors.ink500}
                />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.editLabel}>Name / Title</Text>
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Memorial name"
              placeholderTextColor={Colors.ink300}
            />

            {/* Description */}
            <Text style={styles.editLabel}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Write something about this person..."
              placeholderTextColor={Colors.ink300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* ── Photos ───────────────────────────────────────── */}
            <View style={styles.editMediaHeader}>
              <Text style={styles.editLabel}>Photos</Text>
              <TouchableOpacity
                style={styles.editAddBtn}
                onPress={() => pickEditMedia("photos")}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={Colors.green700}
                />
                <Text style={styles.editAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {editPhotos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {editPhotos.map((item, idx) => (
                    <View key={idx} style={styles.editMediaThumb}>
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.editMediaImg}
                      />
                      {item.isNew && (
                        <View style={styles.editNewBadge}>
                          <Text style={styles.editNewBadgeText}>NEW</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.editRemoveBtn}
                        onPress={() =>
                          setEditPhotos((cur) =>
                            cur.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={20}
                          color="#E05252"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.editEmptyHint}>
                No photos — tap Add to upload
              </Text>
            )}

            {/* ── Videos ───────────────────────────────────────── */}
            <View style={styles.editMediaHeader}>
              <Text style={styles.editLabel}>Videos</Text>
              <TouchableOpacity
                style={styles.editAddBtn}
                onPress={() => pickEditMedia("videos")}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={Colors.green700}
                />
                <Text style={styles.editAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {editVideos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {editVideos.map((item, idx) => (
                    <View key={idx} style={styles.editMediaThumb}>
                      <View
                        style={[
                          styles.editMediaImg,
                          {
                            backgroundColor: "#1a1a1a",
                            justifyContent: "center",
                            alignItems: "center",
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="video-outline"
                          size={28}
                          color="rgba(255,255,255,0.5)"
                        />
                      </View>
                      {item.isNew && (
                        <View style={styles.editNewBadge}>
                          <Text style={styles.editNewBadgeText}>NEW</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.editRemoveBtn}
                        onPress={() =>
                          setEditVideos((cur) =>
                            cur.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={20}
                          color="#E05252"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.editEmptyHint}>
                No videos — tap Add to upload
              </Text>
            )}

            {/* ── Audio ────────────────────────────────────────── */}
            <View style={styles.editMediaHeader}>
              <Text style={styles.editLabel}>Audio</Text>
              <TouchableOpacity
                style={styles.editAddBtn}
                onPress={() => pickEditMedia("audios")}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={Colors.green700}
                />
                <Text style={styles.editAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {editAudios.length > 0 ? (
              <View style={{ marginBottom: 8, gap: 6 }}>
                {editAudios.map((item, idx) => {
                  const audioUri = item.uri ?? item;
                  const audioName =
                    item.name ||
                    audioUri.split("/").pop() ||
                    `Audio ${idx + 1}`;
                  return (
                    <View key={idx} style={styles.editAudioRow}>
                      <MaterialCommunityIcons
                        name="music-note"
                        size={18}
                        color={Colors.green700}
                      />
                      <Text style={styles.editAudioName} numberOfLines={1}>
                        {audioName}
                      </Text>
                      {item.isNew && (
                        <View
                          style={[
                            styles.editNewBadge,
                            { position: "relative", marginRight: 4 },
                          ]}
                        >
                          <Text style={styles.editNewBadgeText}>NEW</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() =>
                          setEditAudios((cur) =>
                            cur.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={20}
                          color="#E05252"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.editEmptyHint}>
                No audio — tap Add to upload
              </Text>
            )}

            {/* Status banner + Save */}
            <StatusBanner type={editBanner?.type} message={editBanner?.text} />
            <TouchableOpacity
              style={[styles.editSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              <Text style={styles.editSaveBtnText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation popup */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteConfirmVisible(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            {/* Layered icon rings */}
            <View style={styles.deleteRingOuter}>
              <View style={styles.deleteRingInner}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={34}
                  color="#C0392B"
                />
              </View>
            </View>

            <Text style={styles.deleteTitle}>Delete Memory?</Text>
            <Text style={styles.deleteSubtitle}>
              Once deleted, this memory is gone forever and{"\n"}cannot be recovered.
            </Text>

            <View style={styles.deleteDivider} />

            {/* Stacked buttons */}
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, deleting && { opacity: 0.55 }]}
              onPress={confirmDelete}
              disabled={deleting}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={deleting ? "loading" : "trash-can-outline"}
                size={18}
                color={Colors.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.deleteConfirmText}>
                {deleting ? "Deleting..." : "Yes, Delete It"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => setDeleteConfirmVisible(false)}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteCancelText}>Keep Memory</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cream,
  },
  empty: {
    color: Colors.ink500,
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },

  // Top nav
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  navRight: {
    flexDirection: "row",
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  navBtnText: {
    fontSize: 18,
    color: Colors.ink700,
  },

  // Edit modal
  editOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  editSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  editTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.ink700,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.ink500,
    marginBottom: 6,
    marginTop: 12,
  },
  editInput: {
    backgroundColor: "#F5F3EF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ink700,
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  editTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  editSaveBtn: {
    backgroundColor: Colors.green700,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  editSaveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
  },

  // Edit media
  editMediaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  editAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(108,171,144,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editAddBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.green700,
  },
  editMediaThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: "visible",
  },
  editMediaImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  editRemoveBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: 10,
  },
  editNewBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: Colors.green700,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  editNewBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: "800",
  },
  editAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF5F1",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.green100,
  },
  editAudioName: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink700,
    fontWeight: "500",
  },
  editEmptyHint: {
    fontSize: 13,
    color: Colors.ink300,
    fontStyle: "italic",
    marginBottom: 8,
  },

  // Dropdown menu
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  menuDropdown: {
    position: "absolute",
    top: 96,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink700,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.ink100,
    marginHorizontal: 12,
  },

  // Profile card
  profileCard: {
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.ink100,
    marginBottom: 14,
  },
  avatarFrame: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Colors.green300,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: Colors.ink100,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.ink700,
    textAlign: "center",
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: Colors.ink500,
    textAlign: "center",
    lineHeight: 20,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.ink100,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
  },
  tabLabel: {
    fontSize: 14,
    color: Colors.ink500,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: Colors.ink700,
    fontWeight: "700",
  },

  // Tab content
  tabContent: {
    paddingHorizontal: 16,
  },

  // Memories tab
  memoryPost: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.ink100,
    marginBottom: 14,
  },
  postPhotoRow: {
    flexDirection: "row",
    height: 200,
    gap: 2,
  },
  postPhoto: {
    flex: 1,
    backgroundColor: Colors.ink100,
  },
  postDescription: {
    padding: 16,
    fontSize: 14,
    color: Colors.ink500,
    lineHeight: 22,
  },

  // Gallery tab
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  galleryPhoto: {
    width: "49.5%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: Colors.ink100,
  },

  // Audio tab
  audioItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.ink100,
    marginBottom: 10,
    gap: 10,
  },
  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  audioPlayIcon: {
    color: Colors.white,
    fontSize: 14,
    marginLeft: 2,
  },
  audioWave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  audioBar: {
    width: 3,
    backgroundColor: Colors.green500,
    borderRadius: 2,
  },
  audioDuration: {
    fontSize: 12,
    color: Colors.ink500,
  },

  // Video thumbnails in Memories tab
  videoThumbRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  videoThumbSmall: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111",
    maxWidth: "33%",
  },
  videoThumbDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a1a",
  },
  // Video grid (Videos tab)
  videoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },
  videoThumb: {
    width: "49.5%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  // Shared play overlay
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  videoPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlayIcon: {
    fontSize: 16,
    color: "#222",
    marginLeft: 3,
  },
  videoMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoMoreText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // Delete confirmation popup
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(30,20,15,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  deleteCard: {
    width: "100%",
    backgroundColor: Colors.cardBg,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  deleteRingOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(192,57,43,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },
  deleteRingInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(192,57,43,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.ink700,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  deleteSubtitle: {
    fontSize: 14,
    color: Colors.ink500,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 0,
  },
  deleteDivider: {
    width: "100%",
    height: 1,
    backgroundColor: Colors.ink100,
    marginVertical: 24,
  },
  deleteConfirmBtn: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#C0392B",
    marginBottom: 12,
    shadowColor: "#C0392B",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
    letterSpacing: 0.2,
  },
  deleteCancelBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.ink100,
    alignItems: "center",
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink600,
  },
});
