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
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import VideoPlayerModal from "../components/VideoPlayerModal";
import { memorialService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

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
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons
              name="dots-grid"
              size={20}
              color={Colors.ink700}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <MaterialCommunityIcons
              name="dots-vertical"
              size={20}
              color={Colors.ink700}
            />
          </TouchableOpacity>
        </View>
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
});
