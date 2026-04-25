import { useEffect, useCallback, useMemo, useRef, useState } from "react";
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
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import VideoPlayerModal from "../components/VideoPlayerModal";
import { useFocusEffect } from "@react-navigation/native";
import { isSupabaseConfigured } from "../config/supabase";
import { memorialService, authService, storageService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

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

const MEMORIALS_STORAGE_KEY = "gnf_memorials";

// ─── Top-level components (must be outside HomeScreen to avoid remounting) ───

function PhotoTile({ uri, style, tileStyle }) {
  const [broken, setBroken] = useState(false);
  return (
    <View style={[tileStyle, { overflow: "hidden" }]}>
      {broken ? (
        <View style={[StyleSheet.absoluteFill, styles.brokenImageTile]}>
          <MaterialCommunityIcons
            name="image-broken-variant"
            size={28}
            color="rgba(255,255,255,0.35)"
          />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={style || StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      )}
    </View>
  );
}

function AudioBubble({ uri }) {
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

  // Natural-looking waveform — fixed heights so it never changes shape
  const WAVE = [
    0.3, 0.5, 0.7, 0.9, 0.6, 1.0, 0.8, 0.5, 0.7, 0.4, 0.9, 0.6, 0.8, 1.0, 0.5,
    0.7, 0.9, 0.4, 0.6, 0.8, 0.5, 0.9, 0.7, 0.4, 0.8, 0.6, 1.0, 0.5,
  ];

  const displayTime =
    positionMs > 0
      ? fmt(positionMs)
      : durationMs > 0
        ? fmt(durationMs)
        : "0:00";

  return (
    <View style={styles.audioBubble}>
      <TouchableOpacity style={styles.audioBubbleBtn} onPress={toggle}>
        <MaterialCommunityIcons
          name={status.playing ? "pause" : "play"}
          size={16}
          color="#fff"
          style={{ marginLeft: status.playing ? 0 : 2 }}
        />
      </TouchableOpacity>
      <View style={styles.audioBubbleWave}>
        {WAVE.map((h, i) => (
          <View
            key={i}
            style={[
              styles.audioBubbleBar,
              { height: Math.max(3, h * 22) },
              i / WAVE.length <= progress
                ? styles.audioBubbleBarFilled
                : styles.audioBubbleBarEmpty,
            ]}
          />
        ))}
      </View>
      <Text style={styles.audioBubbleTime}>{displayTime}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memorials, setMemorials] = useState(
    isSupabaseConfigured ? [] : DEMO_MEMORIALS,
  );
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [draftVideos, setDraftVideos] = useState([]);
  const [draftAudios, setDraftAudios] = useState([]);
  const [videoModal, setVideoModal] = useState({ visible: false, uri: null });

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
    if (!isSupabaseConfigured) {
      try {
        const stored = await AsyncStorage.getItem(MEMORIALS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMemorials(parsed.length > 0 ? parsed : DEMO_MEMORIALS);
        } else {
          setMemorials(DEMO_MEMORIALS);
        }
      } catch {
        setMemorials(DEMO_MEMORIALS);
      }
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

  // Reload when navigating back to this screen
  useFocusEffect(
    useCallback(() => {
      loadMemorials();
    }, [userId]),
  );

  // Persist memorials to AsyncStorage whenever they change (demo / offline mode)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      AsyncStorage.setItem(
        MEMORIALS_STORAGE_KEY,
        JSON.stringify(memorials),
      ).catch(() => {});
    }
  }, [memorials]);

  // Convert blob: URIs (returned by Expo Go picker) to local file:// URIs
  const resolveBlobUri = async (uri, ext = "jpg") => {
    if (!uri.startsWith("blob:")) return uri;
    const dest = `${FileSystem.cacheDirectory}picked_${Date.now()}.${ext}`;
    const { uri: localUri } = await FileSystem.downloadAsync(uri, dest);
    return localUri;
  };

  const pickDraftMedia = async (mediaType) => {
    try {
      if (mediaType === "audios") {
        // expo-document-picker v14+ API: { canceled, assets }
        const result = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        setDraftAudios((cur) => [
          ...cur,
          { uri: result.assets[0].uri, name: result.assets[0].name },
        ]);
      } else {
        // Request permission before opening the picker
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow access to your photo library to add photos and videos.",
          );
          return;
        }
        // expo-image-picker v17+ uses string literals, not MediaTypeOptions
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: mediaType === "photos" ? "images" : "videos",
          allowsEditing: false,
          quality: 0.8,
          allowsMultipleSelection: true,
        });
        if (result.canceled || !result.assets?.length) return;
        // Resolve any blob: URIs to local file:// URIs
        const uris = await Promise.all(
          result.assets.map((a) =>
            resolveBlobUri(a.uri, mediaType === "photos" ? "jpg" : "mp4"),
          ),
        );
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
    if (!isSupabaseConfigured) {
      const local = {
        id: `local-${Date.now()}`,
        title,
        years: "Forever remembered",
        description,
        visibility: "public",
        createdAt: new Date(),
        photos: draftPhotos,
        videos: draftVideos,
        audios: draftAudios.map((a) => a.uri ?? a),
      };
      setMemorials((cur) => [local, ...cur]);
      resetModal();
      return;
    }
    setLoading(true);

    // Step 1 — create DB record
    const createResult = await memorialService.createMemorial(userId, {
      title,
      description,
      visibility: "public",
      photos: [],
      videos: [],
      audios: [],
    });
    if (!createResult.success) {
      Alert.alert("Error", createResult.error || "Could not create memorial");
      setLoading(false);
      return;
    }

    const memorialId = createResult.id;

    // Capture drafts before modal reset clears them
    const photosToUpload = [...draftPhotos];
    const videosToUpload = [...draftVideos];
    const audiosToUpload = [...draftAudios];

    // Step 2 — show memorial immediately with local URIs (optimistic)
    const optimistic = {
      id: memorialId,
      title,
      description,
      visibility: "public",
      created_at: new Date().toISOString(),
      photos: photosToUpload,
      videos: videosToUpload,
      audios: audiosToUpload.map((a) => a.uri ?? a),
    };
    setMemorials((cur) => [optimistic, ...cur]);
    resetModal(); // Close the modal right away — uploads continue in background
    setLoading(false);

    // Step 3 — upload every picked file to Supabase Storage
    const uploadOne = async (uri, mediaKind) => {
      const ext =
        uri.split(".").pop().split("?")[0] ||
        (mediaKind === "photos"
          ? "jpg"
          : mediaKind === "videos"
            ? "mp4"
            : "mp3");
      const fileName = `${mediaKind}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const res = await storageService.uploadFile(
        uri,
        fileName,
        `memorials/${memorialId}`,
      );
      if (!res.success) console.warn(`[upload] failed for ${uri}:`, res.error);
      return res.success ? res.url : null;
    };

    const [photoUrls, videoUrls, audioUrls] = await Promise.all([
      Promise.all(photosToUpload.map((uri) => uploadOne(uri, "photos"))),
      Promise.all(videosToUpload.map((uri) => uploadOne(uri, "videos"))),
      Promise.all(audiosToUpload.map((a) => uploadOne(a.uri ?? a, "audios"))),
    ]);

    const cleanPhotos = photoUrls.filter(Boolean);
    const cleanVideos = videoUrls.filter(Boolean);
    const cleanAudios = audioUrls.filter(Boolean);

    // Step 4 — patch DB with cloud URLs and reload to reflect them
    if (cleanPhotos.length || cleanVideos.length || cleanAudios.length) {
      await memorialService.updateMemorial(memorialId, {
        photos: cleanPhotos,
        videos: cleanVideos,
        audios: cleanAudios,
      });
      await loadMemorials(); // Replace optimistic local URIs with cloud URLs
    }

    const total = photoUrls.length + videoUrls.length + audioUrls.length;
    const failed =
      total - (cleanPhotos.length + cleanVideos.length + cleanAudios.length);
    if (failed > 0) {
      Alert.alert(
        failed === total ? "Upload Failed" : "Partial Upload",
        `${failed} of ${total} file(s) could not be saved to cloud. They are visible now but may not appear after restarting the app.`,
      );
    }
  };

  const uploadMedia = async (memorialId, mediaType) => {
    try {
      let fileUri;
      if (mediaType === "audios") {
        const pickerResult = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
          copyToCacheDirectory: true,
        });
        if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;
        fileUri = pickerResult.assets[0].uri;
      } else {
        // Request permission before opening picker
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow access to your photo library to add photos and videos.",
          );
          return;
        }
        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: mediaType === "photos" ? "images" : "videos",
          allowsEditing: false,
          quality: 0.8,
        });
        if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;
        // Resolve blob: URIs → file:// so Image can render and upload can read
        const ext = mediaType === "photos" ? "jpg" : "mp4";
        fileUri = await resolveBlobUri(pickerResult.assets[0].uri, ext);
      }

      // Show media immediately in the card (optimistic UI)
      setMemorials((cur) =>
        cur.map((m) =>
          m.id === memorialId
            ? { ...m, [mediaType]: [...(m[mediaType] || []), fileUri] }
            : m,
        ),
      );

      if (!isSupabaseConfigured) return; // demo mode — local URI is enough

      setLoading(true);
      const extension =
        fileUri.split(".").pop().split("?")[0] ||
        (mediaType === "photos"
          ? "jpg"
          : mediaType === "videos"
            ? "mp4"
            : "mp3");
      const uniqueFileName = `${memorialId}-${Date.now()}.${extension}`;
      const uploadResult = await storageService.uploadFile(
        fileUri,
        uniqueFileName,
        `memorials/${memorialId}`,
      );
      if (!uploadResult.success) {
        Alert.alert(
          "Upload failed",
          uploadResult.error ||
            "Could not upload to cloud. Media is visible locally but may not persist after restart.",
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
          "Save failed",
          appendResult.error ||
            "File uploaded but could not be saved to memory.",
        );
      } else {
        await loadMemorials(); // Replace local URI with Supabase URL
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Could not upload media");
    } finally {
      setLoading(false);
    }
  };

  const renderMemoryCard = ({ item }) => {
    const raw = item.createdAt ?? item.created_at;
    const date =
      raw instanceof Date
        ? raw
        : raw?.toDate
          ? raw.toDate()
          : raw
            ? new Date(raw)
            : new Date();
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    const fullDate = `${month} ${getOrdinal(day)}, ${date.getFullYear()}`;

    // Build a unified media grid: photos first, then video tiles
    const photos = item.photos || [];
    const videos = item.videos || [];
    const audios = item.audios || [];

    // Instagram-style media grid
    const renderMediaGrid = () => {
      const totalMedia = photos.length + videos.length;
      if (totalMedia === 0) return null;

      // Single photo — 4:3 landscape
      if (totalMedia === 1 && photos.length === 1) {
        return <PhotoTile uri={photos[0]} tileStyle={styles.mediaSingle} />;
      }

      // Single video — 4:3 landscape tile
      if (totalMedia === 1 && videos.length === 1) {
        return (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.mediaSingleVideo}
            onPress={() => setVideoModal({ visible: true, uri: videos[0] })}
          >
            <LinearGradient
              colors={["#2c3e50", "#1c1c1e"]}
              style={[StyleSheet.absoluteFill, styles.videoTileBg]}
            >
              <MaterialCommunityIcons
                name="play-circle"
                size={52}
                color="rgba(255,255,255,0.9)"
              />
            </LinearGradient>
            <View style={styles.videoTileBadge}>
              <MaterialCommunityIcons name="video" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
        );
      }

      // 2 items — side by side 1:1
      if (totalMedia === 2) {
        const items = [
          ...photos.map((u) => ({ type: "photo", uri: u })),
          ...videos.map((u) => ({ type: "video", uri: u })),
        ];
        return (
          <View style={styles.mediaRow2}>
            {items.map((m, i) =>
              m.type === "photo" ? (
                <PhotoTile key={i} uri={m.uri} tileStyle={styles.mediaHalf} />
              ) : (
                <TouchableOpacity
                  key={i}
                  style={styles.mediaHalf}
                  activeOpacity={0.9}
                  onPress={() => setVideoModal({ visible: true, uri: m.uri })}
                >
                  <LinearGradient
                    colors={["#2c3e50", "#1c1c1e"]}
                    style={[StyleSheet.absoluteFill, styles.videoTileBg]}
                  >
                    <MaterialCommunityIcons
                      name="play-circle"
                      size={36}
                      color="rgba(255,255,255,0.9)"
                    />
                  </LinearGradient>
                  <View style={styles.videoTileBadge}>
                    <MaterialCommunityIcons
                      name="video"
                      size={11}
                      color="#fff"
                    />
                  </View>
                </TouchableOpacity>
              ),
            )}
          </View>
        );
      }

      // 3+ items — Instagram 3-column grid, first item taller on left
      const allItems = [
        ...photos.map((u) => ({ type: "photo", uri: u })),
        ...videos.map((u) => ({ type: "video", uri: u })),
      ];
      const shown = allItems.slice(0, 3);
      const extra = totalMedia - 3;

      const renderTile = (m, i, style) => {
        if (m.type === "photo") {
          return <PhotoTile key={i} uri={m.uri} tileStyle={style} />;
        }
        return (
          <TouchableOpacity
            key={i}
            style={style}
            activeOpacity={0.9}
            onPress={() => setVideoModal({ visible: true, uri: m.uri })}
          >
            <LinearGradient
              colors={["#2c3e50", "#1c1c1e"]}
              style={[StyleSheet.absoluteFill, styles.videoTileBg]}
            >
              <MaterialCommunityIcons
                name="play-circle"
                size={i === 0 ? 42 : 30}
                color="rgba(255,255,255,0.9)"
              />
            </LinearGradient>
            <View style={styles.videoTileBadge}>
              <MaterialCommunityIcons name="video" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
        );
      };

      return (
        <View style={styles.mediaGrid3}>
          {/* Left: large tile */}
          {renderTile(shown[0], 0, styles.mediaGrid3Left)}
          {/* Right: two stacked tiles */}
          <View style={styles.mediaGrid3Right}>
            {shown[1] && renderTile(shown[1], 1, styles.mediaGrid3SmallTop)}
            {shown[2] && (
              <View style={styles.mediaGrid3SmallBottom}>
                {renderTile(shown[2], 2, StyleSheet.absoluteFill)}
                {extra > 0 && (
                  <View style={styles.mediaGridMoreOverlay}>
                    <Text style={styles.mediaGridMoreText}>+{extra}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      );
    };

    return (
      <View style={styles.memoryCard}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeDay}>{getOrdinal(day)}</Text>
            <Text style={styles.dateBadgeMonth}>{month}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memoryDateText}>{fullDate}</Text>
            <Text style={styles.memoryTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cardDetailBtn}
            onPress={() =>
              navigation.navigate("Detail", { memorialId: item.id })
            }
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={Colors.ink500}
            />
          </TouchableOpacity>
        </View>

        {/* Full-width media grid */}
        {renderMediaGrid()}

        {/* Audio players */}
        {audios.length > 0 && (
          <View style={styles.cardAudioSection}>
            {audios.slice(0, 2).map((uri, idx) => (
              <AudioBubble key={`${uri}-${idx}`} uri={uri} />
            ))}
            {audios.length > 2 && (
              <Text style={styles.audioMore}>
                +{audios.length - 2} more audio
                {audios.length - 2 > 1 ? "s" : ""}
              </Text>
            )}
          </View>
        )}

        {/* Caption */}
        {!!item.description && (
          <View style={styles.cardCaption}>
            <Text style={styles.memoryDescription} numberOfLines={3}>
              {item.description}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.mediaActionBtn}
            onPress={() => uploadMedia(item.id, "photos")}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="image-plus"
              size={13}
              color={Colors.green700}
            />
            <Text style={styles.mediaActionText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaActionBtn}
            onPress={() => uploadMedia(item.id, "videos")}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="video-plus-outline"
              size={13}
              color={Colors.green700}
            />
            <Text style={styles.mediaActionText}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaActionBtn}
            onPress={() => uploadMedia(item.id, "audios")}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="microphone-plus"
              size={13}
              color={Colors.green700}
            />
            <Text style={styles.mediaActionText}>Audio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={styles.header}>
                <AppLogo size={36} />
                <View style={{ flex: 1, marginLeft: 12 }}>
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
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.actionLabelPrimary}>Add memory</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => navigation.navigate("Profile")}
                >
                  <MaterialCommunityIcons
                    name="account-circle-outline"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Your profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => navigation.navigate("ScanQR")}
                >
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => navigation.navigate("GenerateQR")}
                >
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Generate QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => navigation.navigate("Story")}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant-outline"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Story</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => navigation.navigate("PlukQR")}
                >
                  <MaterialCommunityIcons
                    name="star-four-points-outline"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Pluk QR Code</Text>
                </TouchableOpacity>
              </View>

              {/* Memories section header */}
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Your Memories</Text>
                <TouchableOpacity
                  onPress={() =>
                    setSortBy(sortBy === "newest" ? "oldest" : "newest")
                  }
                >
                  <MaterialCommunityIcons
                    name={
                      sortBy === "newest"
                        ? "sort-calendar-descending"
                        : "sort-calendar-ascending"
                    }
                    size={22}
                    color={Colors.ink500}
                  />
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={styles.searchBar}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
                  color={Colors.ink300}
                  style={{ marginRight: 6 }}
                />
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
            </>
          }
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

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setShowCreateModal(true)}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {videoModal.visible && videoModal.uri && (
        <VideoPlayerModal
          uri={videoModal.uri}
          onClose={() => setVideoModal({ visible: false, uri: null })}
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
                  {draftAudios.map((item, idx) => (
                    <View key={idx} style={styles.fileRow}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {item.name || item.uri?.split("/").pop()}
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardDetailBtn: {
    padding: 4,
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
  memoryDateText: {
    fontSize: 12,
    color: Colors.ink500,
    marginBottom: 2,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink700,
  },
  // ── Media grid ───────────────────────────────────────
  mediaSingle: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
  },
  brokenImageTile: {
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaSingleVideo: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
  },
  mediaRow2: {
    flexDirection: "row",
    gap: 2,
    height: 200,
  },
  mediaHalf: {
    flex: 1,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
  },
  mediaGrid3: {
    flexDirection: "row",
    gap: 2,
    height: 220,
  },
  mediaGrid3Left: {
    flex: 2,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
  },
  mediaGrid3Right: {
    flex: 1,
    gap: 2,
  },
  mediaGrid3SmallTop: {
    flex: 1,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
  },
  mediaGrid3SmallBottom: {
    flex: 1,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
    position: "relative",
  },
  mediaGridMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaGridMoreText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  // ── Video tile overlays ───────────────────────────────
  videoTileBg: {
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },
  videoTileBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  // ── Audio section ─────────────────────────────────────
  cardAudioSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 6,
  },
  // ── Caption ───────────────────────────────────────────
  cardCaption: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  memoryDescription: {
    fontSize: 14,
    color: Colors.ink500,
    lineHeight: 20,
  },
  // ── Action buttons ────────────────────────────────────
  cardActions: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mediaActions: {
    flexDirection: "row",
    gap: 6,
  },
  mediaActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.green500,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 20,
  },
  // Audio bubble in card
  audioList: {
    marginTop: 6,
    gap: 6,
  },
  audioBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF5F1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.green100,
  },
  audioBubbleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  audioBubbleWave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: 3,
    overflow: "hidden",
  },
  audioBubbleBar: {
    width: 3,
    borderRadius: 3,
  },
  audioBubbleBarFilled: {
    backgroundColor: Colors.green700,
  },
  audioBubbleBarEmpty: {
    backgroundColor: "#A8C8B8",
  },
  audioBubbleTime: {
    fontSize: 11,
    color: Colors.ink700,
    fontWeight: "600",
    minWidth: 34,
    textAlign: "right",
  },
  audioMore: {
    fontSize: 11,
    color: Colors.ink500,
    paddingLeft: 4,
    marginTop: 2,
  },
});
