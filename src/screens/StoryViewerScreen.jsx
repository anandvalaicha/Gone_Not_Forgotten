import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Video, Audio } from "expo-av";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Colors } from "../theme/colors";
import { memorialService } from "../services";
import AppLogo from "../components/AppLogo";

export default function StoryViewerScreen({ navigation, route }) {
  const { id: storyId } = route.params || {};
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);
  const soundRef = useRef(null);

  useEffect(() => {
    loadStory();
  }, [storyId]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const loadStory = async () => {
    if (!storyId) {
      setError(true);
      setLoading(false);
      return;
    }
    const result = await memorialService.getSharedStory(storyId);
    if (result.success && result.story) {
      setStory(result.story);
    } else {
      setError(true);
    }
    setLoading(false);
  };

  const toggleAudio = async (uri) => {
    if (playingAudio === uri) {
      await soundRef.current?.pauseAsync().catch(() => {});
      setPlayingAudio(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.didJustFinish) setPlayingAudio(null);
        },
      );
      soundRef.current = sound;
      setPlayingAudio(uri);
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.green700} />
        <Text style={styles.loadingText}>Loading story…</Text>
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={52}
          color={Colors.ink300}
        />
        <Text style={styles.errorText}>Could not load this story.</Text>
        <Text style={styles.errorSub}>
          The link may be invalid or the story was removed.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const d = story.data || {};
  const storyType = story.story_type || d.storyType;

  const allPhotos =
    storyType === "status"
      ? (d.slides || []).map((s) => ({
          uri: s.uri,
          text: s.text,
          caption: s.caption,
        }))
      : storyType === "slideshow"
        ? (d.slideshowItems || []).map((s) => ({
            uri: s.uri,
            caption: s.caption,
          }))
        : (d.tributePhotos || []).map((uri) => ({ uri }));

  const allVideos =
    storyType === "status"
      ? d.statusVideos || []
      : storyType === "slideshow"
        ? d.slideshowVideos || []
        : d.tributeVideos || [];

  const allAudios =
    storyType === "status"
      ? d.statusAudios || []
      : storyType === "slideshow"
        ? d.slideshowAudios || []
        : d.tributeAudios || [];

  const storyTypeLabel =
    storyType === "status"
      ? "Status Story"
      : storyType === "written"
        ? "Written Tribute"
        : "Slideshow";

  const storyTypeIcon =
    storyType === "status"
      ? "camera-iris"
      : storyType === "written"
        ? "script-text"
        : "play-box-multiple";

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
          <AppLogo size={26} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {story.title}
          </Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Type badge */}
        <View style={styles.typeBadge}>
          <MaterialCommunityIcons
            name={storyTypeIcon}
            size={14}
            color={Colors.green700}
          />
          <Text style={styles.typeBadgeText}>{storyTypeLabel}</Text>
        </View>

        {/* Written tribute text */}
        {storyType === "written" && d.tributeText ? (
          <View style={styles.tributeCard}>
            <Text style={styles.tributeText}>{d.tributeText}</Text>
          </View>
        ) : null}

        {/* Photos */}
        {allPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allPhotos.map((item, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                  {item.text ? (
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText} numberOfLines={3}>
                        {item.text}
                      </Text>
                    </View>
                  ) : null}
                  {item.caption ? (
                    <Text style={styles.photoCaption} numberOfLines={1}>
                      {item.caption}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Videos */}
        {allVideos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Videos</Text>
            {allVideos.map((uri, idx) => (
              <Video
                key={idx}
                source={{ uri }}
                style={styles.videoPlayer}
                useNativeControls
                shouldPlay={false}
                resizeMode="contain"
              />
            ))}
          </View>
        )}

        {/* Audio */}
        {allAudios.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Audio</Text>
            {allAudios.map((item, idx) => {
              const uri = typeof item === "string" ? item : item.uri;
              const name =
                typeof item === "string"
                  ? uri.split("/").pop() || "Audio file"
                  : item.name || "Audio file";
              const isPlaying = playingAudio === uri;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.audioRow}
                  onPress={() => toggleAudio(uri)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.audioPlayBtn,
                      isPlaying && styles.audioPlayBtnActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isPlaying ? "pause" : "play"}
                      size={20}
                      color={isPlaying ? "#fff" : Colors.green700}
                    />
                  </View>
                  <Text style={styles.audioName} numberOfLines={1}>
                    {name}
                  </Text>
                  {isPlaying && (
                    <MaterialCommunityIcons
                      name="volume-high"
                      size={18}
                      color={Colors.green700}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cream,
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, color: Colors.ink500 },
  errorText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.ink700,
    textAlign: "center",
  },
  errorSub: { fontSize: 13, color: Colors.ink500, textAlign: "center" },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 14, color: Colors.green700, fontWeight: "600" },

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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.ink700,
    flex: 1,
    textAlign: "center",
  },

  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },

  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.green100,
  },
  typeBadgeText: { fontSize: 12, fontWeight: "600", color: Colors.green700 },

  tributeCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  tributeText: { fontSize: 15, color: Colors.ink700, lineHeight: 24 },

  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.ink500,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 12,
  },

  photoWrap: { marginRight: 12, width: 160 },
  photoThumb: {
    width: 160,
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.ink100,
  },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  photoOverlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  photoCaption: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.ink500,
    paddingHorizontal: 2,
  },

  videoPlayer: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: "#000",
    marginBottom: 12,
  },

  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  audioPlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.green700,
    justifyContent: "center",
    alignItems: "center",
  },
  audioPlayBtnActive: {
    backgroundColor: Colors.green700,
    borderColor: Colors.green700,
  },
  audioName: { flex: 1, fontSize: 14, color: Colors.ink700 },
});
