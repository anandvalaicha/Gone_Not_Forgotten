import { useRef, useState, useEffect, useCallback } from "react";
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
  Dimensions,
  Animated,
  Share,
  FlatList,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, Audio } from "expo-av";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { isSupabaseConfigured } from "../config/supabase";
import { memorialService, authService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function PreviewAudioSlide({ uri, onEnd }) {
  useEffect(() => {
    let sound = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) onEnd();
          },
        );
        sound = s;
      } catch {
        onEnd();
      }
    })();
    return () => {
      sound?.unloadAsync().catch(() => {});
    };
  }, [uri]);
  return null;
}

// ── Story Type Tabs ──
const STORY_TYPES = [
  { key: "status", label: "Status Story", icon: "camera-iris" },
  { key: "written", label: "Written Tribute", icon: "script-text" },
  { key: "slideshow", label: "Slideshow", icon: "play-box-multiple" },
];

export default function StoryScreen({ navigation }) {
  const [storyType, setStoryType] = useState("status");
  const [storyTitle, setStoryTitle] = useState("");

  // Status story slides
  const [slides, setSlides] = useState([]);

  // Written tribute
  const [tributeText, setTributeText] = useState("");
  const [tributePhotos, setTributePhotos] = useState([]);

  // Slideshow
  const [slideshowItems, setSlideshowItems] = useState([]);

  // Videos & audios per section
  const [statusVideos, setStatusVideos] = useState([]);
  const [statusAudios, setStatusAudios] = useState([]);
  const [tributeVideos, setTributeVideos] = useState([]);
  const [tributeAudios, setTributeAudios] = useState([]);
  const [slideshowVideos, setSlideshowVideos] = useState([]);
  const [slideshowAudios, setSlideshowAudios] = useState([]);

  // Preview
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Memory picker
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [memorials, setMemorials] = useState([]);
  const [loadingMemorials, setLoadingMemorials] = useState(false);
  const [memoryPickTarget, setMemoryPickTarget] = useState(null);

  const user = authService.getCurrentUser();
  const userId = user?.uid || "demo-user-001";

  // ── Load memorials ──
  useEffect(() => {
    (async () => {
      setLoadingMemorials(true);
      if (!isSupabaseConfigured) {
        setMemorials([
          {
            id: "demo-1",
            title: "Eleanor Grace",
            photos: [
              "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80",
              "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=900&q=80",
              "https://images.unsplash.com/photo-1511895426328-dc8714191011?w=900&q=80",
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80",
            ],
          },
        ]);
      } else {
        const result = await memorialService.getUserMemorials(userId);
        if (result.success) setMemorials(result.memorials);
      }
      setLoadingMemorials(false);
    })();
  }, []);

  // ── Pick photo from device ──
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return null;
      return result.assets.map((a) => a.uri);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick photo");
      return null;
    }
  };

  // ── Pick video from device ──
  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return null;
      return result.assets.map((a) => a.uri);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick video");
      return null;
    }
  };

  // ── Pick audio from device ──
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return null;
      const assets = result.assets || (result.uri ? [result] : []);
      if (!assets.length) return null;
      return assets.map((a) => ({
        uri: a.uri,
        name: a.name || a.uri.split("/").pop() || "audio",
      }));
    } catch (e) {
      Alert.alert("Error", e.message || "Could not pick audio");
      return null;
    }
  };

  // ── Status Story: add slide ──
  const addSlideFromDevice = async () => {
    const uris = await pickPhoto();
    if (!uris) return;
    setSlides((prev) => [
      ...prev,
      ...uris.map((uri) => ({ uri, text: "", caption: "" })),
    ]);
  };

  const addSlideFromMemory = () => {
    setMemoryPickTarget("status");
    setMemoryModalVisible(true);
  };

  const removeSlide = (idx) =>
    setSlides((prev) => prev.filter((_, i) => i !== idx));

  const updateSlideText = (idx, text) =>
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, text } : s)));

  const updateSlideCaption = (idx, caption) =>
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, caption } : s)),
    );

  // Status Story: video & audio
  const addStatusVideoFromDevice = async () => {
    const uris = await pickVideo();
    if (!uris) return;
    setStatusVideos((prev) => [...prev, ...uris]);
  };
  const addStatusVideoFromMemory = () => {
    setMemoryPickTarget("status-video");
    setMemoryModalVisible(true);
  };
  const removeStatusVideo = (idx) =>
    setStatusVideos((prev) => prev.filter((_, i) => i !== idx));

  const addStatusAudioFromDevice = async () => {
    const items = await pickAudio();
    if (!items) return;
    setStatusAudios((prev) => [...prev, ...items]);
  };
  const addStatusAudioFromMemory = () => {
    setMemoryPickTarget("status-audio");
    setMemoryModalVisible(true);
  };
  const removeStatusAudio = (idx) =>
    setStatusAudios((prev) => prev.filter((_, i) => i !== idx));

  // ── Written Tribute: add photos ──
  const addTributePhotoFromDevice = async () => {
    const uris = await pickPhoto();
    if (!uris) return;
    setTributePhotos((prev) => [...prev, ...uris]);
  };

  const addTributePhotoFromMemory = () => {
    setMemoryPickTarget("tribute");
    setMemoryModalVisible(true);
  };

  const removeTributePhoto = (idx) =>
    setTributePhotos((prev) => prev.filter((_, i) => i !== idx));

  // Written Tribute: video & audio
  const addTributeVideoFromDevice = async () => {
    const uris = await pickVideo();
    if (!uris) return;
    setTributeVideos((prev) => [...prev, ...uris]);
  };
  const addTributeVideoFromMemory = () => {
    setMemoryPickTarget("tribute-video");
    setMemoryModalVisible(true);
  };
  const removeTributeVideo = (idx) =>
    setTributeVideos((prev) => prev.filter((_, i) => i !== idx));

  const addTributeAudioFromDevice = async () => {
    const items = await pickAudio();
    if (!items) return;
    setTributeAudios((prev) => [...prev, ...items]);
  };
  const addTributeAudioFromMemory = () => {
    setMemoryPickTarget("tribute-audio");
    setMemoryModalVisible(true);
  };
  const removeTributeAudio = (idx) =>
    setTributeAudios((prev) => prev.filter((_, i) => i !== idx));

  // ── Slideshow: add items ──
  const addSlideshowFromDevice = async () => {
    const uris = await pickPhoto();
    if (!uris) return;
    setSlideshowItems((prev) => [
      ...prev,
      ...uris.map((uri) => ({ uri, caption: "" })),
    ]);
  };

  const addSlideshowFromMemory = () => {
    setMemoryPickTarget("slideshow");
    setMemoryModalVisible(true);
  };

  const removeSlideshowItem = (idx) =>
    setSlideshowItems((prev) => prev.filter((_, i) => i !== idx));

  const updateSlideshowCaption = (idx, caption) =>
    setSlideshowItems((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, caption } : s)),
    );

  // Slideshow: video & audio
  const addSlideshowVideoFromDevice = async () => {
    const uris = await pickVideo();
    if (!uris) return;
    setSlideshowVideos((prev) => [...prev, ...uris]);
  };
  const addSlideshowVideoFromMemory = () => {
    setMemoryPickTarget("slideshow-video");
    setMemoryModalVisible(true);
  };
  const removeSlideshowVideo = (idx) =>
    setSlideshowVideos((prev) => prev.filter((_, i) => i !== idx));

  const addSlideshowAudioFromDevice = async () => {
    const items = await pickAudio();
    if (!items) return;
    setSlideshowAudios((prev) => [...prev, ...items]);
  };
  const addSlideshowAudioFromMemory = () => {
    setMemoryPickTarget("slideshow-audio");
    setMemoryModalVisible(true);
  };
  const removeSlideshowAudio = (idx) =>
    setSlideshowAudios((prev) => prev.filter((_, i) => i !== idx));

  // ── Memory picker select ──
  const selectFromMemory = (item) => {
    const uri = typeof item === "string" ? item : item.uri;
    const name =
      typeof item === "string" ? uri.split("/").pop() || "audio" : item.name;

    if (memoryPickTarget === "status") {
      if (!slides.find((s) => s.uri === uri))
        setSlides((prev) => [...prev, { uri, text: "", caption: "" }]);
    } else if (memoryPickTarget === "tribute") {
      if (!tributePhotos.includes(uri))
        setTributePhotos((prev) => [...prev, uri]);
    } else if (memoryPickTarget === "slideshow") {
      if (!slideshowItems.find((s) => s.uri === uri))
        setSlideshowItems((prev) => [...prev, { uri, caption: "" }]);
    } else if (memoryPickTarget === "status-video") {
      if (!statusVideos.includes(uri))
        setStatusVideos((prev) => [...prev, uri]);
    } else if (memoryPickTarget === "tribute-video") {
      if (!tributeVideos.includes(uri))
        setTributeVideos((prev) => [...prev, uri]);
    } else if (memoryPickTarget === "slideshow-video") {
      if (!slideshowVideos.includes(uri))
        setSlideshowVideos((prev) => [...prev, uri]);
    } else if (memoryPickTarget === "status-audio") {
      if (!statusAudios.find((a) => a.uri === uri))
        setStatusAudios((prev) => [...prev, { uri, name }]);
    } else if (memoryPickTarget === "tribute-audio") {
      if (!tributeAudios.find((a) => a.uri === uri))
        setTributeAudios((prev) => [...prev, { uri, name }]);
    } else if (memoryPickTarget === "slideshow-audio") {
      if (!slideshowAudios.find((a) => a.uri === uri))
        setSlideshowAudios((prev) => [...prev, { uri, name }]);
    }
  };

  const getMemoryPhotos = () => {
    const items = [];
    memorials.forEach((m) => {
      (m.photos || []).forEach((uri) =>
        items.push({ uri, memorialTitle: m.title }),
      );
    });
    return items;
  };

  const getMemoryVideos = () => {
    const items = [];
    memorials.forEach((m) => {
      (m.videos || []).forEach((uri) =>
        items.push({ uri, name: uri.split("/").pop() || "video", memorialTitle: m.title }),
      );
    });
    return items;
  };

  const getMemoryAudios = () => {
    const items = [];
    memorials.forEach((m) => {
      (m.audios || []).forEach((uri) =>
        items.push({ uri, name: uri.split("/").pop() || "audio", memorialTitle: m.title }),
      );
    });
    return items;
  };

  // ── Preview logic ──
  const getPreviewSlides = useCallback(() => {
    const result = [];
    if (storyType === "status") {
      slides.forEach((s) =>
        result.push({ type: "photo", uri: s.uri, text: s.text, caption: s.caption }),
      );
      statusVideos.forEach((uri) => result.push({ type: "video", uri }));
      statusAudios.forEach((item) =>
        result.push({ type: "audio", uri: item.uri, name: item.name }),
      );
    } else if (storyType === "slideshow") {
      slideshowItems.forEach((s) =>
        result.push({ type: "photo", uri: s.uri, text: "", caption: s.caption }),
      );
      slideshowVideos.forEach((uri) => result.push({ type: "video", uri }));
      slideshowAudios.forEach((item) =>
        result.push({ type: "audio", uri: item.uri, name: item.name }),
      );
    } else {
      tributePhotos.forEach((uri, i) =>
        result.push({
          type: "photo",
          uri,
          text: i === 0 ? storyTitle : "",
          caption:
            i === tributePhotos.length - 1 ? tributeText.slice(0, 120) : "",
        }),
      );
      tributeVideos.forEach((uri) => result.push({ type: "video", uri }));
      tributeAudios.forEach((item) =>
        result.push({ type: "audio", uri: item.uri, name: item.name }),
      );
    }
    return result;
  }, [
    storyType,
    slides, statusVideos, statusAudios,
    slideshowItems, slideshowVideos, slideshowAudios,
    tributePhotos, tributeVideos, tributeAudios,
    tributeText, storyTitle,
  ]);

  const openPreview = () => {
    const ps = getPreviewSlides();
    if (ps.length === 0) {
      Alert.alert("Nothing to preview", "Add some media or write something first.");
      return;
    }
    setPreviewIndex(0);
    setPreviewVisible(true);
  };

  // Auto-advance preview — photos use a 5s timer; video/audio advance via media end callbacks
  useEffect(() => {
    if (!previewVisible) return;
    const ps = getPreviewSlides();
    const current = ps[previewIndex];
    progressAnim.setValue(0);

    if (!current || current.type !== "photo") return;

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && previewIndex < ps.length - 1) {
        setPreviewIndex((i) => i + 1);
      } else if (finished) {
        setPreviewVisible(false);
      }
    });

    return () => anim.stop();
  }, [previewVisible, previewIndex]);

  const goNextPreview = () => {
    const ps = getPreviewSlides();
    if (previewIndex < ps.length - 1) {
      setPreviewIndex((i) => i + 1);
    } else {
      setPreviewVisible(false);
    }
  };

  const goPrevPreview = () => {
    if (previewIndex > 0) setPreviewIndex((i) => i - 1);
  };

  // ── Share story ──
  const handleShare = async () => {
    const count =
      storyType === "status"
        ? slides.length
        : storyType === "slideshow"
          ? slideshowItems.length
          : tributePhotos.length;
    if (count === 0 && !tributeText.trim() && !storyTitle.trim()) {
      Alert.alert("Empty", "Create your story first before sharing.");
      return;
    }
    try {
      await Share.share({
        title: storyTitle || "My Memorial Story",
        message: `${storyTitle || "My Memorial Story"}\n\n${tributeText || `A memorial story with ${count} slide${count !== 1 ? "s" : ""}.`}`,
      });
    } catch {}
  };

  const canPreview =
    storyType === "status"
      ? slides.length > 0 || statusVideos.length > 0 || statusAudios.length > 0
      : storyType === "slideshow"
        ? slideshowItems.length > 0 || slideshowVideos.length > 0 || slideshowAudios.length > 0
        : tributePhotos.length > 0 || tributeVideos.length > 0 || tributeAudios.length > 0 || tributeText.trim().length > 0;

  const previewSlides = getPreviewSlides();

  // ─────────── Preview Modal ───────────
  const renderPreview = () => {
    const current = previewSlides[previewIndex];
    return (
      <Modal
        visible={previewVisible}
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewContainer}>
          {/* ── Background / media ── */}
          {current?.type === "video" ? (
            <Video
              key={previewIndex}
              source={{ uri: current.uri }}
              style={styles.previewImage}
              shouldPlay
              isLooping={false}
              resizeMode="cover"
              onPlaybackStatusUpdate={(status) => {
                if (status.didJustFinish) goNextPreview();
              }}
            />
          ) : current?.type === "audio" ? (
            <>
              <View style={[styles.previewImage, styles.previewAudioBg]}>
                <MaterialCommunityIcons
                  name="music-circle"
                  size={110}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.previewAudioLabel} numberOfLines={2}>
                  {current.name}
                </Text>
              </View>
              <PreviewAudioSlide
                key={previewIndex}
                uri={current.uri}
                onEnd={goNextPreview}
              />
            </>
          ) : current?.uri ? (
            <Image
              source={{ uri: current.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.previewImage, { backgroundColor: "#2A2A2A" }]} />
          )}

          {/* Dark overlay */}
          <View style={styles.previewOverlay} />

          {/* Progress bars */}
          <View style={styles.progressBarRow}>
            {previewSlides.map((slide, idx) => (
              <View key={idx} style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        idx < previewIndex
                          ? "100%"
                          : idx === previewIndex && slide.type === "photo"
                            ? progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0%", "100%"],
                              })
                            : idx === previewIndex
                              ? "100%"
                              : "0%",
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewVisible(false)}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Type badge for video/audio */}
          {current?.type === "video" && (
            <View style={styles.previewTypeBadge}>
              <MaterialCommunityIcons name="play-circle" size={16} color="#fff" />
              <Text style={styles.previewTypeBadgeText}>Video</Text>
            </View>
          )}
          {current?.type === "audio" && (
            <View style={styles.previewTypeBadge}>
              <MaterialCommunityIcons name="music-note" size={16} color="#fff" />
              <Text style={styles.previewTypeBadgeText}>Audio</Text>
            </View>
          )}

          {/* Text overlay */}
          {current?.text ? (
            <View style={styles.previewTextOverlay}>
              <Text style={styles.previewText}>{current.text}</Text>
            </View>
          ) : null}

          {/* Caption */}
          {current?.caption ? (
            <View style={styles.previewCaptionArea}>
              <Text style={styles.previewCaption}>{current.caption}</Text>
            </View>
          ) : null}

          {/* Slide counter */}
          <View style={styles.previewCounter}>
            <Text style={styles.previewCounterText}>
              {previewIndex + 1} / {previewSlides.length}
            </Text>
          </View>

          {/* Tap zones for nav */}
          <View style={styles.previewTapZones}>
            <TouchableOpacity
              style={styles.tapLeft}
              onPress={goPrevPreview}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.tapRight}
              onPress={goNextPreview}
              activeOpacity={1}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // ─────────── Builder View ───────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={Colors.ink700}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AppLogo size={28} />
          <Text style={styles.headerTitle}>Create Story</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.builderContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Story type tabs */}
        <View style={styles.typeTabs}>
          {STORY_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.typeTab,
                storyType === t.key && styles.typeTabActive,
              ]}
              onPress={() => setStoryType(t.key)}
            >
              <MaterialCommunityIcons
                name={t.icon}
                size={18}
                color={storyType === t.key ? Colors.white : Colors.ink300}
              />
              <Text
                style={[
                  styles.typeTabText,
                  storyType === t.key && styles.typeTabTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Story title */}
        <View style={styles.builderSection}>
          <Text style={styles.builderSectionTitle}>Story Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Give your story a name…"
            placeholderTextColor={Colors.ink300}
            value={storyTitle}
            onChangeText={setStoryTitle}
          />
        </View>

        {/* ── STATUS STORY ── */}
        {storyType === "status" && (
          <View style={styles.builderSection}>
            <Text style={styles.builderSectionTitle}>
              Story Slides ({slides.length})
            </Text>
            <Text style={styles.sectionHint}>
              Add photos and write text overlays for each slide.
            </Text>

            <Text style={styles.mediaCategoryLabel}>Photos</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideFromMemory}
              >
                <MaterialCommunityIcons
                  name="image-album"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideFromDevice}
              >
                <MaterialCommunityIcons
                  name="upload"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.mediaCategoryLabel}>Videos</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addStatusVideoFromMemory}
              >
                <MaterialCommunityIcons
                  name="video-box"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addStatusVideoFromDevice}
              >
                <MaterialCommunityIcons
                  name="video-plus"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Video</Text>
              </TouchableOpacity>
            </View>
            {statusVideos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mediaRow}
              >
                {statusVideos.map((uri, idx) => (
                  <View key={idx} style={styles.thumbWrap}>
                    <View style={styles.videoThumb}>
                      <MaterialCommunityIcons
                        name="play-circle"
                        size={32}
                        color="#fff"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeStatusVideo(idx)}
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
            )}

            <Text style={styles.mediaCategoryLabel}>Audio</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addStatusAudioFromMemory}
              >
                <MaterialCommunityIcons
                  name="music-box"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addStatusAudioFromDevice}
              >
                <MaterialCommunityIcons
                  name="music-note-plus"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Audio</Text>
              </TouchableOpacity>
            </View>
            {statusAudios.map((item, idx) => (
              <View key={idx} style={styles.audioRow}>
                <MaterialCommunityIcons
                  name="music-note"
                  size={20}
                  color={Colors.green700}
                />
                <Text style={styles.audioName} numberOfLines={1}>
                  {item.name}
                </Text>
                <TouchableOpacity onPress={() => removeStatusAudio(idx)}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={Colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {slides.length > 0 ? (
              slides.map((slide, idx) => (
                <View key={idx} style={styles.slideCard}>
                  <Image
                    source={{ uri: slide.uri }}
                    style={styles.slideImage}
                    resizeMode="cover"
                  />
                  <View style={styles.slideOverlay}>
                    {slide.text ? (
                      <Text style={styles.slideOverlayText}>{slide.text}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.slideRemove}
                    onPress={() => removeSlide(idx)}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={22}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                  <View style={styles.slideIndex}>
                    <Text style={styles.slideIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.slideInputs}>
                    <TextInput
                      style={styles.slideTextInput}
                      placeholder="Text overlay…"
                      placeholderTextColor={Colors.ink300}
                      value={slide.text}
                      onChangeText={(t) => updateSlideText(idx, t)}
                      maxLength={120}
                    />
                    <TextInput
                      style={styles.slideCaptionInput}
                      placeholder="Caption…"
                      placeholderTextColor={Colors.ink300}
                      value={slide.caption}
                      onChangeText={(t) => updateSlideCaption(idx, t)}
                      maxLength={200}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>
                No slides yet — add photos to get started
              </Text>
            )}
          </View>
        )}

        {/* ── WRITTEN TRIBUTE ── */}
        {storyType === "written" && (
          <>
            <View style={styles.builderSection}>
              <Text style={styles.builderSectionTitle}>Your Tribute</Text>
              <Text style={styles.sectionHint}>
                Write a heartfelt tribute, memory, or story.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Share your thoughts, memories, or a tribute…"
                placeholderTextColor={Colors.ink300}
                multiline
                value={tributeText}
                onChangeText={setTributeText}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.builderSection}>
              <Text style={styles.builderSectionTitle}>Media</Text>

              <Text style={styles.mediaCategoryLabel}>Photos</Text>
              <View style={styles.mediaBtnRow}>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributePhotoFromMemory}
                >
                  <MaterialCommunityIcons
                    name="image-album"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>From Memory</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributePhotoFromDevice}
                >
                  <MaterialCommunityIcons
                    name="upload"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>Upload Photo</Text>
                </TouchableOpacity>
              </View>
              {tributePhotos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.mediaRow}
                >
                  {tributePhotos.map((uri, idx) => (
                    <View key={idx} style={styles.thumbWrap}>
                      <Image source={{ uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeTributePhoto(idx)}
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
              )}

              <Text style={styles.mediaCategoryLabel}>Videos</Text>
              <View style={styles.mediaBtnRow}>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributeVideoFromMemory}
                >
                  <MaterialCommunityIcons
                    name="video-box"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>From Memory</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributeVideoFromDevice}
                >
                  <MaterialCommunityIcons
                    name="video-plus"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>Upload Video</Text>
                </TouchableOpacity>
              </View>
              {tributeVideos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.mediaRow}
                >
                  {tributeVideos.map((uri, idx) => (
                    <View key={idx} style={styles.thumbWrap}>
                      <View style={styles.videoThumb}>
                        <MaterialCommunityIcons
                          name="play-circle"
                          size={32}
                          color="#fff"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeTributeVideo(idx)}
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
              )}

              <Text style={styles.mediaCategoryLabel}>Audio</Text>
              <View style={styles.mediaBtnRow}>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributeAudioFromMemory}
                >
                  <MaterialCommunityIcons
                    name="music-box"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>From Memory</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={addTributeAudioFromDevice}
                >
                  <MaterialCommunityIcons
                    name="music-note-plus"
                    size={18}
                    color={Colors.green700}
                  />
                  <Text style={styles.sourceBtnText}>Upload Audio</Text>
                </TouchableOpacity>
              </View>
              {tributeAudios.map((item, idx) => (
                <View key={idx} style={styles.audioRow}>
                  <MaterialCommunityIcons
                    name="music-note"
                    size={20}
                    color={Colors.green700}
                  />
                  <Text style={styles.audioName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity onPress={() => removeTributeAudio(idx)}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── SLIDESHOW ── */}
        {storyType === "slideshow" && (
          <View style={styles.builderSection}>
            <Text style={styles.builderSectionTitle}>
              Slideshow Photos ({slideshowItems.length})
            </Text>
            <Text style={styles.sectionHint}>
              Add photos and captions — they'll play as a slideshow.
            </Text>

            <Text style={styles.mediaCategoryLabel}>Photos</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowFromMemory}
              >
                <MaterialCommunityIcons
                  name="image-album"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowFromDevice}
              >
                <MaterialCommunityIcons
                  name="upload"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.mediaCategoryLabel}>Videos</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowVideoFromMemory}
              >
                <MaterialCommunityIcons
                  name="video-box"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowVideoFromDevice}
              >
                <MaterialCommunityIcons
                  name="video-plus"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Video</Text>
              </TouchableOpacity>
            </View>
            {slideshowVideos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mediaRow}
              >
                {slideshowVideos.map((uri, idx) => (
                  <View key={idx} style={styles.thumbWrap}>
                    <View style={styles.videoThumb}>
                      <MaterialCommunityIcons
                        name="play-circle"
                        size={32}
                        color="#fff"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeSlideshowVideo(idx)}
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
            )}

            <Text style={styles.mediaCategoryLabel}>Audio</Text>
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowAudioFromMemory}
              >
                <MaterialCommunityIcons
                  name="music-box"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>From Memory</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={addSlideshowAudioFromDevice}
              >
                <MaterialCommunityIcons
                  name="music-note-plus"
                  size={18}
                  color={Colors.green700}
                />
                <Text style={styles.sourceBtnText}>Upload Audio</Text>
              </TouchableOpacity>
            </View>
            {slideshowAudios.map((item, idx) => (
              <View key={idx} style={styles.audioRow}>
                <MaterialCommunityIcons
                  name="music-note"
                  size={20}
                  color={Colors.green700}
                />
                <Text style={styles.audioName} numberOfLines={1}>
                  {item.name}
                </Text>
                <TouchableOpacity onPress={() => removeSlideshowAudio(idx)}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={Colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {slideshowItems.length > 0 ? (
              slideshowItems.map((item, idx) => (
                <View key={idx} style={styles.slideshowRow}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.slideshowThumb}
                  />
                  <View style={styles.slideshowInfo}>
                    <Text style={styles.slideshowNum}>Slide {idx + 1}</Text>
                    <TextInput
                      style={styles.slideshowCaptionInput}
                      placeholder="Add caption…"
                      placeholderTextColor={Colors.ink300}
                      value={item.caption}
                      onChangeText={(t) => updateSlideshowCaption(idx, t)}
                      maxLength={200}
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeSlideshowItem(idx)}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={22}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>
                No photos yet — add some for the slideshow
              </Text>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={[styles.shareBtn, !canPreview && { opacity: 0.5 }]}
            onPress={openPreview}
            disabled={!canPreview}
          >
            <MaterialCommunityIcons name="play" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Preview Story</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manageBtn} onPress={handleShare}>
            <MaterialCommunityIcons
              name="share-variant"
              size={18}
              color={Colors.ink700}
            />
            <Text style={styles.manageBtnText}>Share Story</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.modalTitle}>Select from Memory</Text>
            <Text style={styles.modalHint}>
              {memoryPickTarget?.endsWith("-audio")
                ? "Tap audio files to add them to your story."
                : memoryPickTarget?.endsWith("-video")
                  ? "Tap videos to add them to your story."
                  : "Tap photos to add them to your story."}
            </Text>

            {loadingMemorials ? (
              <ActivityIndicator
                size="large"
                color={Colors.green700}
                style={{ marginTop: 20 }}
              />
            ) : memoryPickTarget?.endsWith("-audio") ? (
              // ── Audio list ──
              <FlatList
                data={getMemoryAudios()}
                keyExtractor={(item, idx) => `${item.uri}-${idx}`}
                ListEmptyComponent={
                  <Text style={styles.emptyModalText}>
                    No audio found in your memories.
                  </Text>
                }
                renderItem={({ item }) => {
                  const isSelected =
                    memoryPickTarget === "status-audio"
                      ? statusAudios.some((a) => a.uri === item.uri)
                      : memoryPickTarget === "tribute-audio"
                        ? tributeAudios.some((a) => a.uri === item.uri)
                        : slideshowAudios.some((a) => a.uri === item.uri);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.memoryAudioItem,
                        isSelected && styles.memoryAudioItemSelected,
                      ]}
                      onPress={() => selectFromMemory(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="music-note"
                        size={22}
                        color={isSelected ? Colors.green700 : Colors.ink500}
                      />
                      <Text style={styles.memoryAudioName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={Colors.green700}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            ) : memoryPickTarget?.endsWith("-video") ? (
              // ── Video list ──
              <FlatList
                data={getMemoryVideos()}
                keyExtractor={(item, idx) => `${item.uri}-${idx}`}
                ListEmptyComponent={
                  <Text style={styles.emptyModalText}>
                    No videos found in your memories.
                  </Text>
                }
                renderItem={({ item }) => {
                  const isSelected =
                    memoryPickTarget === "status-video"
                      ? statusVideos.includes(item.uri)
                      : memoryPickTarget === "tribute-video"
                        ? tributeVideos.includes(item.uri)
                        : slideshowVideos.includes(item.uri);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.memoryAudioItem,
                        isSelected && styles.memoryAudioItemSelected,
                      ]}
                      onPress={() => selectFromMemory(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="video"
                        size={22}
                        color={isSelected ? Colors.green700 : Colors.ink500}
                      />
                      <Text style={styles.memoryAudioName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={Colors.green700}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            ) : (
              // ── Photo grid ──
              <FlatList
                data={getMemoryPhotos()}
                keyExtractor={(item, idx) => `${item.uri}-${idx}`}
                numColumns={3}
                columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
                ListEmptyComponent={
                  <Text style={styles.emptyModalText}>
                    No photos found in your memories.
                  </Text>
                }
                renderItem={({ item }) => {
                  const isSelected =
                    memoryPickTarget === "status"
                      ? slides.some((s) => s.uri === item.uri)
                      : memoryPickTarget === "tribute"
                        ? tributePhotos.includes(item.uri)
                        : slideshowItems.some((s) => s.uri === item.uri);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.memoryGridItem,
                        isSelected && styles.memoryGridItemSelected,
                      ]}
                      onPress={() => selectFromMemory(item.uri)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.memoryGridThumb}
                      />
                      {isSelected && (
                        <View style={styles.memoryGridCheck}>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={24}
                            color={Colors.green700}
                          />
                        </View>
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

      {/* Preview modal */}
      {renderPreview()}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.cream,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink700,
  },

  // ── Builder content ──
  builderContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ── Story type tabs ──
  typeTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  typeTab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ink100,
  },
  typeTabActive: {
    backgroundColor: Colors.green700,
    borderColor: Colors.green700,
  },
  typeTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.ink300,
    textAlign: "center",
  },
  typeTabTextActive: {
    color: Colors.white,
  },

  // ── Builder sections ──
  builderSection: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  builderSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.ink500,
    lineHeight: 18,
    marginBottom: 14,
  },

  // ── Title input ──
  titleInput: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.ink700,
  },

  // ── Text area ──
  textArea: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.ink700,
    minHeight: 160,
  },

  // ── Source buttons ──
  mediaBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.cream,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.green100,
  },
  sourceBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.green700,
  },

  // ── Slide card (status story) ──
  slideCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: Colors.cardBg,
  },
  slideImage: {
    width: "100%",
    height: 200,
  },
  slideOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  slideOverlayText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
    textAlign: "center",
    paddingHorizontal: 20,
  },
  slideRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
  },
  slideIndex: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  slideIndexText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  slideInputs: {
    padding: 12,
    gap: 8,
  },
  slideTextInput: {
    backgroundColor: Colors.cream,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.ink700,
  },
  slideCaptionInput: {
    backgroundColor: Colors.cream,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.ink500,
  },

  // ── Slideshow row ──
  slideshowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ink100,
  },
  slideshowThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.cream,
  },
  slideshowInfo: {
    flex: 1,
  },
  slideshowNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink500,
    marginBottom: 4,
  },
  slideshowCaptionInput: {
    backgroundColor: Colors.cream,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.ink700,
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
    backgroundColor: Colors.cream,
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: Colors.white,
    borderRadius: 10,
  },

  // ── Media category label ──
  mediaCategoryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.ink500,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },

  // ── Video thumbnail ──
  videoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Audio row ──
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.cream,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  audioName: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink700,
  },

  // ── Memory audio/video list items ──
  memoryAudioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ink100,
  },
  memoryAudioItemSelected: {
    backgroundColor: Colors.green100 + "33",
    borderRadius: 8,
  },
  memoryAudioName: {
    flex: 1,
    fontSize: 14,
    color: Colors.ink700,
  },

  // ── Empty hint ──
  emptyHint: {
    fontSize: 13,
    color: Colors.ink300,
    textAlign: "center",
    paddingVertical: 14,
  },

  // ── Action buttons ──
  actionBtns: {
    gap: 12,
    marginTop: 8,
  },
  shareBtn: {
    backgroundColor: Colors.green700,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  manageBtn: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  manageBtnText: {
    color: Colors.ink700,
    fontWeight: "600",
    fontSize: 16,
  },

  // ── Preview (fullscreen dark overlay) ──
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewImage: {
    width: SCREEN_W,
    height: SCREEN_H,
    position: "absolute",
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  progressBarRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 54,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  previewAudioBg: {
    backgroundColor: "#0d1b2a",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  previewAudioLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  previewTypeBadge: {
    position: "absolute",
    top: 110,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewTypeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  previewCloseBtn: {
    position: "absolute",
    top: 66,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTextOverlay: {
    position: "absolute",
    top: "35%",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  previewText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
    textAlign: "center",
    lineHeight: 34,
  },
  previewCaptionArea: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewCaption: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
  },
  previewCounter: {
    position: "absolute",
    top: 68,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewCounterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  previewTapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    top: 100,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },

  // ── Memory Picker Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 24,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 6,
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

  // ── Memory grid ──
  memoryGridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: "31%",
  },
  memoryGridItemSelected: {
    borderWidth: 2,
    borderColor: Colors.green700,
  },
  memoryGridThumb: {
    width: "100%",
    height: "100%",
  },
  memoryGridCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
});
