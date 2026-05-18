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
  Platform,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
// expo-file-system v19 split the API. The legacy import still exposes the
// classic cacheDirectory / documentDirectory / downloadAsync / copyAsync
// helpers that this screen relies on for staging picked media.
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
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
import StatusBanner from "../components/StatusBanner";

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

  // Reset broken state whenever the URI changes (e.g. local → cloud URL after upload)
  useEffect(() => {
    setBroken(false);
  }, [uri]);

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

// ── Instagram-style full-width media carousel ─────────────────────────────
function MediaCarousel({ items, onVideoPress }) {
  const [page, setPage] = useState(0);
  const { width: screenW } = useWindowDimensions();
  // feedList paddingHorizontal:16 × 2 = 32
  const SLIDE_W = screenW - 32;
  const scrollRef = useRef(null);

  const goToPage = (idx) => {
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * SLIDE_W, animated: true });
    setPage(clamped);
  };

  if (!items || items.length === 0) return null;

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SLIDE_W}
        snapToAlignment="start"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
          setPage(Math.min(idx, items.length - 1));
        }}
        style={{ width: SLIDE_W }}
      >
        {items.map((item, i) =>
          item.type === "photo" ? (
            <PhotoTile
              key={i}
              uri={item.uri}
              tileStyle={{ width: SLIDE_W, aspectRatio: 1 }}
              style={{ width: SLIDE_W, height: SLIDE_W }}
            />
          ) : (
            <TouchableOpacity
              key={i}
              activeOpacity={0.9}
              onPress={() => onVideoPress(item.uri)}
              style={{
                width: SLIDE_W,
                aspectRatio: 1,
                backgroundColor: "#1c1c1e",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <LinearGradient
                colors={["#2c3e50", "#1c1c1e"]}
                style={StyleSheet.absoluteFill}
              />
              <MaterialCommunityIcons
                name="play-circle"
                size={60}
                color="rgba(255,255,255,0.9)"
              />
              <View style={carouselStyles.videoBadge}>
                <MaterialCommunityIcons name="video" size={12} color="#fff" />
                <Text style={carouselStyles.videoBadgeText}>Video</Text>
              </View>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      {/* Count badge top-right */}
      {items.length > 1 && (
        <View style={carouselStyles.countBadge}>
          <Text style={carouselStyles.countText}>
            {page + 1}/{items.length}
          </Text>
        </View>
      )}

      {/* Left / Right arrow buttons */}
      {items.length > 1 && page > 0 && (
        <TouchableOpacity
          style={[carouselStyles.arrowBtn, carouselStyles.arrowLeft]}
          onPress={() => goToPage(page - 1)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      {items.length > 1 && page < items.length - 1 && (
        <TouchableOpacity
          style={[carouselStyles.arrowBtn, carouselStyles.arrowRight]}
          onPress={() => goToPage(page + 1)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-right" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Dot indicators — tappable */}
      {items.length > 1 && (
        <View style={carouselStyles.dots}>
          {items.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToPage(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  carouselStyles.dot,
                  i === page && carouselStyles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  videoBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  countBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.50)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C0B7AC",
  },
  dotActive: {
    backgroundColor: "#3d7a62",
    width: 16,
  },
  arrowBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderRadius: 22,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
});
// ─────────────────────────────────────────────────────────────────────────────

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
  const [memorials, setMemorials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [draftVideos, setDraftVideos] = useState([]);
  const [draftAudios, setDraftAudios] = useState([]);
  const [modalBanner, setModalBanner] = useState(null);
  const [videoModal, setVideoModal] = useState({ visible: false, uri: null });

  // Prevents useFocusEffect from wiping upload results while an upload is in progress
  const uploadInProgress = useRef(false);

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
    return [...filtered].sort((a, b) => {
      const aDate = a.createdAt ?? a.created_at;
      const bDate = b.createdAt ?? b.created_at;
      if (sortBy === "newest") {
        return new Date(bDate) - new Date(aDate);
      } else if (sortBy === "oldest") {
        return new Date(aDate) - new Date(bDate);
      } else if (sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [memorials, searchQuery, sortBy]);

  const loadMemorials = async () => {
    if (!isSupabaseConfigured) return;
    if (!userId) return;
    setLoading(true);
    const result = await memorialService.getUserMemorials(userId);
    console.log(
      "[loadMemorials] success:",
      result.success,
      "count:",
      result.memorials?.length ?? "n/a",
    );
    if (result.memorials?.[0]) {
      const m = result.memorials[0];
      console.log(
        "[loadMemorials] first memorial:",
        m.id,
        "photos:",
        m.photos?.length ?? 0,
        "videos:",
        m.videos?.length ?? 0,
        "audios:",
        m.audios?.length ?? 0,
      );
    }
    if (result.success) {
      // Strip blob: / ph:// URIs from DB data — they are temporary browser/device
      // handles that crash iOS when React Native tries to load them as images.
      const isCloudUri = (uri) =>
        typeof uri === "string" &&
        !uri.startsWith("blob:") &&
        !uri.startsWith("ph://");
      const cleaned = result.memorials.map((m) => ({
        ...m,
        photos: (m.photos || []).filter(isCloudUri),
        videos: (m.videos || []).filter(isCloudUri),
        audios: (m.audios || []).filter(isCloudUri),
      }));
      setMemorials(cleaned);
    } else {
      Alert.alert("Error", result.error || "Could not load memorials");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMemorials();
  }, [userId]);

  // Reload when navigating back to this screen (skip during active uploads)
  useFocusEffect(
    useCallback(() => {
      if (!uploadInProgress.current) loadMemorials();
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

  // Resolve picker URIs to a stable, uploadable file:// URI.
  // - ph:// (iOS PHAsset)  → file:// via expo-media-library
  // - blob:               → file:// via download to cache (native only)
  // - file:// in demo     → copied to documentDirectory for persistence
  // On web all URIs (blob:, data:, etc.) are passed through unchanged;
  // storageService handles them via fetch() → blob → Supabase SDK.
  const resolveAndPersistUri = async (uri, ext = "jpg") => {
    if (Platform.OS === "web") return uri;

    let resolved = uri;
    console.log("[resolveAndPersistUri] input uri:", uri.slice(0, 100));

    // 0. Convert ph:// (iOS Photos framework) → file:// via MediaLibrary
    if (resolved.startsWith("ph://")) {
      try {
        const assetId = resolved.replace("ph://", "").split("/")[0];
        const info = await MediaLibrary.getAssetInfoAsync(assetId);
        if (info?.localUri) {
          resolved = info.localUri;
          console.log(
            "[resolveAndPersistUri] ph:// → localUri:",
            resolved.slice(0, 100),
          );
        } else {
          console.warn(
            "[resolveAndPersistUri] ph:// has no localUri — keeping as-is",
          );
        }
      } catch (e) {
        console.warn(
          "[resolveAndPersistUri] ph:// resolution failed:",
          e.message,
        );
      }
    }

    // 1. Convert blob: → file:// via download (web only — iOS never returns blob:)
    if (resolved.startsWith("blob:") && Platform.OS === "web") {
      const tmp = `${FileSystem.cacheDirectory}picked_${Date.now()}.${ext}`;
      const { uri: localUri } = await FileSystem.downloadAsync(resolved, tmp);
      resolved = localUri;
    }

    // 2. In demo mode: copy file:// to documentDirectory so it survives restarts
    if (!isSupabaseConfigured && resolved.startsWith("file://")) {
      const filename = `gnf_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const dest = `${FileSystem.documentDirectory}${filename}`;
      try {
        await FileSystem.copyAsync({ from: resolved, to: dest });
        console.log(
          "[resolveAndPersistUri] copied to documentDirectory:",
          dest,
        );
        return dest;
      } catch (e) {
        console.warn(
          "[resolveAndPersistUri] copyAsync failed, using original:",
          e.message,
        );
        return resolved;
      }
    }

    console.log("[resolveAndPersistUri] returning:", resolved.slice(0, 100));
    return resolved;
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
            resolveAndPersistUri(a.uri, mediaType === "photos" ? "jpg" : "mp4"),
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
    setLoading(true);
    uploadInProgress.current = true;

    try {
      // Capture drafts before any state changes
      const photosToUpload = [...draftPhotos];
      const videosToUpload = [...draftVideos];
      const audiosToUpload = [...draftAudios];

      // Step 1 — create DB record first (empty media arrays; filled after upload)
      const createResult = await memorialService.createMemorial(userId, {
        title,
        description,
        visibility: "public",
        photos: [],
        videos: [],
        audios: [],
      });
      if (!createResult.success) {
        Alert.alert(
          "Could not create memorial",
          createResult.error || "Please check your connection and try again.",
        );
        return;
      }

      const memorialId = createResult.id;
      const uploadErrors = [];

      // Step 2 — upload files to Supabase Storage
      const uploadOne = async (uri, mediaKind) => {
        const rawExt = uri.split(".").pop().split("?")[0].toLowerCase();
        // blob: and data: URIs have no real extension — use fallback
        const ext =
          (rawExt.length <= 5 ? rawExt : null) ||
          (mediaKind === "photos"
            ? "jpg"
            : mediaKind === "videos"
              ? "mp4"
              : "mp3");
        const fileName = `${mediaKind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const res = await storageService.uploadFile(uri, fileName, memorialId);
        if (!res.success) {
          uploadErrors.push(res.error || "Unknown upload error");
          console.warn(
            `[createMemorial] ${mediaKind} upload failed:`,
            res.error,
          );
        }
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

      // Step 3 — persist cloud URLs back to DB
      if (cleanPhotos.length || cleanVideos.length || cleanAudios.length) {
        const upd = await memorialService.updateMemorial(memorialId, {
          photos: cleanPhotos,
          videos: cleanVideos,
          audios: cleanAudios,
        });
        if (!upd.success)
          console.warn("[createMemorial] DB update failed:", upd.error);
      }

      // Step 4 — add to local state so it appears immediately
      setMemorials((cur) => [
        {
          id: memorialId,
          title,
          description,
          visibility: "public",
          created_at: new Date().toISOString(),
          photos: cleanPhotos,
          videos: cleanVideos,
          audios: cleanAudios,
        },
        ...cur,
      ]);
      resetModal();

      const total =
        photosToUpload.length + videosToUpload.length + audiosToUpload.length;
      const failed =
        total - (cleanPhotos.length + cleanVideos.length + cleanAudios.length);
      if (failed > 0) {
        Alert.alert(
          failed === total ? "Media Upload Failed" : "Partial Upload",
          uploadErrors[0] ||
            `${failed} of ${total} file(s) could not be uploaded.\n\nCheck that the Supabase "memorials" storage bucket exists and has upload policies enabled.`,
        );
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Could not save memorial");
    } finally {
      uploadInProgress.current = false;
      setLoading(false);
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
        const ext = mediaType === "photos" ? "jpg" : "mp4";
        fileUri = await resolveAndPersistUri(pickerResult.assets[0].uri, ext);
      }

      // Supabase mode — upload first, then add cloud URL to state
      setLoading(true);
      uploadInProgress.current = true;
      const rawExt = fileUri.split(".").pop().split("?")[0];
      // blob: and data: URIs have no real extension — use fallback
      const extension =
        (rawExt.length <= 5 ? rawExt : null) ||
        (mediaType === "photos"
          ? "jpg"
          : mediaType === "videos"
            ? "mp4"
            : "mp3");
      const uniqueFileName = `${memorialId}-${Date.now()}.${extension}`;
      console.log(
        "[uploadMedia] uploading",
        mediaType,
        "file:",
        fileUri.slice(0, 100),
      );
      const uploadResult = await storageService.uploadFile(
        fileUri,
        uniqueFileName,
        memorialId,
      );
      if (!uploadResult.success) {
        Alert.alert(
          "Upload failed",
          uploadResult.error ||
            "Could not upload to cloud.\n\nMake sure the Supabase 'memorials' storage bucket exists and has upload policies enabled.",
        );
        return;
      }

      // Persist cloud URL to DB, then update local state
      const appendResult = await memorialService.appendMedia(
        memorialId,
        mediaType,
        uploadResult.url,
      );
      if (!appendResult.success) {
        console.warn("[uploadMedia] appendMedia failed:", appendResult.error);
      }

      setMemorials((cur) =>
        cur.map((m) =>
          m.id === memorialId
            ? { ...m, [mediaType]: [...(m[mediaType] || []), uploadResult.url] }
            : m,
        ),
      );
    } catch (error) {
      Alert.alert("Error", error.message || "Could not upload media");
    } finally {
      uploadInProgress.current = false;
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

    const photos = item.photos || [];
    const videos = item.videos || [];
    const audios = item.audios || [];

    const mediaItems = [
      ...photos.map((uri) => ({ type: "photo", uri })),
      ...videos.map((uri) => ({ type: "video", uri })),
    ];

    return (
      <View style={styles.memoryCard}>
        {/* Instagram-style header: avatar + name + date + chevron */}
        <View style={styles.cardHeader}>
          <View style={styles.personAvatar}>
            <Text style={styles.personAvatarText}>
              {item.title?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.memoryTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.memoryDateText}>{fullDate}</Text>
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

        {/* Full-width swipeable media carousel */}
        {mediaItems.length > 0 && (
          <MediaCarousel
            items={mediaItems}
            onVideoPress={(uri) => setVideoModal({ visible: true, uri })}
          />
        )}

        {/* Instagram-style caption: bold name + description */}
        {!!item.description && (
          <View style={styles.cardCaption}>
            <Text style={styles.captionText} numberOfLines={4}>
              <Text style={styles.captionName}>{item.title} </Text>
              {item.description}
            </Text>
          </View>
        )}

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

        {/* Action bar — add more media */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.mediaActionBtn}
            onPress={() => uploadMedia(item.id, "photos")}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="image-plus"
              size={14}
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
              size={14}
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
              size={14}
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
                  <Text style={styles.actionLabel}>Profile QR Code</Text>
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
                  onPress={() => navigation.navigate("PlaqueQR")}
                >
                  <MaterialCommunityIcons
                    name="star-four-points-outline"
                    size={20}
                    color={Colors.ink700}
                  />
                  <Text style={styles.actionLabel}>Plaque QR Code</Text>
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
                  {loading ? "Uploading..." : "Save Memory"}
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
  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  personAvatarText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
  memoryDateText: {
    fontSize: 12,
    color: Colors.ink500,
    marginTop: 1,
  },
  memoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink700,
  },
  // ── Broken image placeholder (used by PhotoTile) ─────
  brokenImageTile: {
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
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
    paddingTop: 8,
    paddingBottom: 2,
  },
  captionName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink700,
  },
  captionText: {
    fontSize: 14,
    color: Colors.ink700,
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
