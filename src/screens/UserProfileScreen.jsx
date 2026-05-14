import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { memorialService, authService } from "../services";
import { isSupabaseConfigured } from "../config/supabase";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";
import VideoPlayerModal from "../components/VideoPlayerModal";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Inline audio player for pluk banner ──────────────────────────────────────
function PlukAudioItem({ uri, index }) {
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
        (status.duration || 0) > 0;
      if (atEnd) player.seekTo(0);
      player.play();
    }
  };
  const fmt = (s) => {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      style={plukAudioStyles.row}
    >
      <View style={plukAudioStyles.playBtn}>
        <MaterialCommunityIcons
          name={status.playing ? "pause" : "play"}
          size={18}
          color="#fff"
        />
      </View>
      <Text style={plukAudioStyles.label} numberOfLines={1}>
        Audio {index + 1}
      </Text>
      <Text style={plukAudioStyles.time}>{fmt(status.currentTime)}</Text>
    </TouchableOpacity>
  );
}
const plukAudioStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2f1ea",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    gap: 10,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3d7a62",
    justifyContent: "center",
    alignItems: "center",
  },
  label: { flex: 1, fontSize: 13, color: Colors.ink700, fontWeight: "500" },
  time: { fontSize: 12, color: Colors.ink500 },
});
// ─────────────────────────────────────────────────────────────────────────────
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

const DEMO_USER_PROFILE = {
  userId: "demo-user-001",
  displayName: "Eleanor Grace",
  bio: "Artist, educator, and devoted mother—painting life's canvas with love and color.",
  avatar:
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80",
  isPublic: true,
  showMemories: true,
  showGallery: true,
  showBio: true,
  memorials: [
    {
      id: "demo-memorial-1",
      title: "Cherished Memories",
      description: "A collection of moments that shaped our lives together.",
      createdAt: new Date("2023-12-01"),
      photos: [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80",
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=900&q=80",
        "https://images.unsplash.com/photo-1511895426328-dc8714191011?w=900&q=80",
      ],
    },
  ],
};

export default function UserProfileScreen({ navigation, route }) {
  const { userId, access, plukId } = route.params || {};
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Memories");
  const [plukPost, setPlukPost] = useState(null);
  const [plukLoading, setPlukLoading] = useState(!!plukId);
  const [plukError, setPlukError] = useState(false);
  const [videoUri, setVideoUri] = useState(null);

  useEffect(() => {
    loadUserProfile();
    if (plukId) loadPlukPost();
  }, [userId]);

  const loadPlukPost = async () => {
    setPlukLoading(true);
    setPlukError(false);

    // 1. Try Supabase first (works cross-device)
    const result = await memorialService.getPlukPost(plukId);
    if (result.success && result.plukPost) {
      setPlukPost(result.plukPost);
      setPlukLoading(false);
      return;
    }

    // 2. Fall back to AsyncStorage (same-device scan)
    try {
      const raw = await AsyncStorage.getItem(`pluk_${plukId}`);
      if (raw) {
        setPlukPost(JSON.parse(raw));
        setPlukLoading(false);
        return;
      }
    } catch (_) {}

    // Both failed — nothing to show
    setPlukError(true);
    setPlukLoading(false);
  };

  const isSectionAllowed = (section) => {
    if (!userProfile) return false;
    const publicKey = {
      bio: "showBio",
      memories: "showMemories",
      gallery: "showGallery",
      videos: "showMemories",
      audio: "showMemories",
    }[section];

    if (!userProfile[publicKey]) return false;
    if (!access || access.length === 0) return true;
    // "bio" is part of the profile card — allow it when "profile" OR "bio" is granted
    if (section === "bio") return access.includes("bio") || access.includes("profile");
    // videos live inside memories
    if (section === "videos") return access.includes("memories");
    // audio has its own toggle key
    if (section === "audio") return access.includes("audio");
    return access.includes(section);
  };

  const loadUserProfile = async () => {
    try {
      if (!isSupabaseConfigured || !userId) {
        setUserProfile(DEMO_USER_PROFILE);
        setLoading(false);
        return;
      }

      const result = await memorialService.getPublicProfile(userId);
      if (!result.success) {
        Alert.alert("Error", "Could not load user profile.");
        navigation.goBack();
        return;
      }

      const { profile } = result;

      // If the profiles table has no row yet (display_name is still the
      // default 'User' fallback), supplement with the signed-in user's local
      // auth data so the name is never blank on your own profile.
      const currentUser = authService.getCurrentUser();
      const isSelf = currentUser?.uid === userId;
      const resolvedName =
        profile.displayName !== "User"
          ? profile.displayName
          : isSelf
            ? currentUser?.displayName ||
              currentUser?.email?.split("@")[0] ||
              "User"
            : "User";
      const resolvedAvatar =
        profile.photoURL || (isSelf ? currentUser?.photoURL : null);

      setUserProfile({
        userId: profile.userId,
        displayName: resolvedName,
        bio: profile.bio || (isSelf ? currentUser?.bio : '') || '',
        avatar: resolvedAvatar,
        birthYear: profile.birthYear || (isSelf ? currentUser?.birthYear : '') || '',
        deathYear: profile.deathYear || (isSelf ? currentUser?.deathYear : '') || '',
        showBio: true,
        showMemories: true,
        showGallery: true,
        memorials: profile.memorials,
      });
      setLoading(false);
    } catch (error) {
      Alert.alert("Error", "Could not load user profile.");
      navigation.goBack();
    }
  };

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const renderMemories = () => {
    if (!isSectionAllowed("memories") || !userProfile.memorials?.length) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="flower-outline"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>No public memories</Text>
          <Text style={styles.emptyText}>
            This user hasn't shared any memories yet.
          </Text>
        </View>
      );
    }

    return userProfile.memorials.map((item) => {
      const raw = item.createdAt;
      const date =
        raw instanceof Date ? raw : raw?.toDate ? raw.toDate() : new Date(raw);
      const day = date.getDate();
      const month = MONTHS[date.getMonth()];
      const fullDate = `${month} ${day}, ${date.getFullYear()}`;

      return (
        <View key={item.id} style={styles.memoryCard}>
          {item.photos?.length > 0 && (
            <View style={styles.photoGrid}>
              {item.photos.slice(0, 4).map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={[
                    styles.photoItem,
                    item.photos.length === 1 && styles.photoSingle,
                    item.photos.length === 3 && idx === 2 && styles.photoWide,
                  ]}
                />
              ))}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.35)"]}
                style={styles.photoGradient}
              />
              <LinearGradient
                colors={["#6cab90", "#3d7a62"]}
                style={styles.dateBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.dateBadgeDay}>{getOrdinal(day)}</Text>
                <Text style={styles.dateBadgeMonth}>{month}</Text>
              </LinearGradient>
            </View>
          )}

          <View style={styles.memoryCardBody}>
            <View style={styles.memoryCardRow}>
              <View style={styles.memoryMeta}>
                <Text style={styles.memoryTitle}>{item.title}</Text>
                <Text style={styles.memoryDate}>{fullDate}</Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.memoryDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
      );
    });
  };

  const renderVideos = () => {
    if (!isSectionAllowed("videos")) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="video-off-outline" size={44} color={Colors.ink300} />
          <Text style={styles.emptyTitle}>Videos not shared</Text>
          <Text style={styles.emptyText}>This user hasn't made their videos public.</Text>
        </View>
      );
    }
    const allVideos = userProfile.memorials?.flatMap((m) => m.videos || []) || [];
    if (allVideos.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="video-off-outline" size={44} color={Colors.ink300} />
          <Text style={styles.emptyTitle}>No videos</Text>
        </View>
      );
    }
    return (
      <View style={styles.videoGrid}>
        {allVideos.map((uri, i) => (
          <TouchableOpacity
            key={i}
            style={styles.videoThumb}
            onPress={() => setVideoUri(uri)}
            activeOpacity={0.85}
          >
            <View style={styles.videoThumbInner}>
              <MaterialCommunityIcons name="play-circle" size={48} color="rgba(255,255,255,0.92)" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderAudio = () => {
    if (!isSectionAllowed("audio")) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="music-off" size={44} color={Colors.ink300} />
          <Text style={styles.emptyTitle}>Audio not shared</Text>
          <Text style={styles.emptyText}>This user hasn't made their audio public.</Text>
        </View>
      );
    }
    const allAudios = userProfile.memorials?.flatMap((m) => m.audios || []) || [];
    if (allAudios.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="music-off" size={44} color={Colors.ink300} />
          <Text style={styles.emptyTitle}>No audio</Text>
        </View>
      );
    }
    return (
      <View style={styles.audioList}>
        {allAudios.map((uri, i) => (
          <PlukAudioItem key={i} uri={uri} index={i} />
        ))}
      </View>
    );
  };

  const renderGallery = () => {
    if (!isSectionAllowed("gallery")) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="image-off-outline"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>Gallery not shared</Text>
          <Text style={styles.emptyText}>
            This user hasn't made their gallery public.
          </Text>
        </View>
      );
    }

    const allPhotos =
      userProfile.memorials?.flatMap((m) => m.photos || []) || [];
    if (allPhotos.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="image-off-outline"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>No photos</Text>
        </View>
      );
    }

    const col1 = allPhotos.filter((_, i) => i % 2 === 0);
    const col2 = allPhotos.filter((_, i) => i % 2 !== 0);

    return (
      <View style={styles.masonryRow}>
        <View style={styles.masonryCol}>
          {col1.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={[
                styles.masonryPhoto,
                { aspectRatio: idx % 3 === 0 ? 1 : idx % 3 === 1 ? 0.75 : 1.3 },
              ]}
            />
          ))}
        </View>
        <View style={styles.masonryCol}>
          {col2.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={[
                styles.masonryPhoto,
                { aspectRatio: idx % 3 === 0 ? 1.3 : idx % 3 === 1 ? 1 : 0.75 },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6cab90" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.error}>
        <MaterialCommunityIcons
          name="account-alert"
          size={64}
          color={Colors.ink300}
        />
        <Text style={styles.errorTitle}>Profile not found</Text>
        <Text style={styles.errorText}>
          This user may not exist or their profile is private.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top section */}
        <View style={styles.topSection}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color="#3d7a62"
            />
          </TouchableOpacity>

          {/* App logo */}
          <View style={{ position: "absolute", top: 56, right: 20 }}>
            <AppLogo size={32} tintColor="#3d7a62" />
          </View>

          {/* Decorative green arc */}
          <View style={styles.greenArc} />

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={["#6cab90", "#3d7a62", "#b8d9cb"]}
              style={styles.avatarGradientRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarWhiteRing}>
                {userProfile.avatar ? (
                  <Image
                    source={{ uri: userProfile.avatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={[styles.avatarImage, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {(userProfile.displayName?.[0] || "?").toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

          {/* Name */}
          <Text style={styles.name}>{userProfile.displayName}</Text>

          {/* Birth – Death years */}
          {(userProfile.birthYear || userProfile.deathYear) && (
            <Text style={styles.lifeYears}>
              {userProfile.birthYear || "?"}
              {" – "}
              {userProfile.deathYear || "Present"}
            </Text>
          )}

          {/* Bio - only show if user allows */}
          {isSectionAllowed("bio") && userProfile.bio && (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          )}
        </View>

        {/* Pluk Post — shown when scanned from a Pluk QR */}
        {plukId && (
          <View style={styles.plukBanner}>
            {/* Header */}
            <View style={styles.plukBannerHeader}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={18}
                color="#3d7a62"
              />
              <Text style={styles.plukBannerTitle}>Pluk Message</Text>
            </View>

            {/* Loading state */}
            {plukLoading && (
              <ActivityIndicator
                size="small"
                color={Colors.green700}
                style={{ marginVertical: 16 }}
              />
            )}

            {/* Error state */}
            {!plukLoading && plukError && (
              <View style={styles.plukErrorBox}>
                <MaterialCommunityIcons
                  name="cloud-off-outline"
                  size={28}
                  color={Colors.ink300}
                />
                <Text style={styles.plukErrorText}>
                  Could not load the shared content.{"\n"}This link may only
                  work on the original device.
                </Text>
              </View>
            )}

            {/* Loaded content */}
            {!plukLoading && plukPost && (
              <>
                {!!plukPost.description && (
                  <Text style={styles.plukBannerDesc}>
                    {plukPost.description}
                  </Text>
                )}

                {plukPost.photos?.length > 0 && (
                  <>
                    <Text style={styles.plukSectionLabel}>Photos</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 6 }}
                    >
                      {plukPost.photos.map((uri, i) => (
                        <Image
                          key={i}
                          source={{ uri }}
                          style={styles.plukThumb}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {plukPost.videos?.length > 0 && (
                  <>
                    <Text style={styles.plukSectionLabel}>Videos</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 6 }}
                    >
                      {plukPost.videos.map((uri, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setVideoUri(uri)}
                          style={styles.plukVideoThumb}
                        >
                          <MaterialCommunityIcons
                            name="play-circle"
                            size={40}
                            color="rgba(255,255,255,0.9)"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {plukPost.audios?.length > 0 && (
                  <>
                    <Text style={styles.plukSectionLabel}>Audio</Text>
                    {plukPost.audios.map((uri, i) => (
                      <PlukAudioItem key={i} uri={uri} index={i} />
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* Video modal */}
        {videoUri && (
          <VideoPlayerModal uri={videoUri} onClose={() => setVideoUri(null)} />
        )}

        {/* When viewing via Pluk QR — show only curated content, not the full profile */}
        {plukId ? (
          <View style={styles.plukFooter}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={16}
              color={Colors.green700}
            />
            <Text style={styles.plukFooterText}>
              This is a curated share — only selected content is shown
            </Text>
          </View>
        ) : (
          <View style={styles.sheet}>
            {/* Tab bar */}
            <View style={styles.tabBar}>
              {["Memories", "Gallery", "Videos", "Audio"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabBtn,
                    activeTab === tab && styles.tabBtnActive,
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  {activeTab === tab ? (
                    <View style={styles.tabBtnActiveInner}>
                      <Text style={styles.tabLabelActive}>{tab}</Text>
                    </View>
                  ) : (
                    <Text style={styles.tabLabel}>{tab}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Green accent line */}
            <View style={styles.accentLine}>
              <LinearGradient
                colors={["transparent", "#6cab90", "transparent"]}
                style={styles.accentLineGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>

            {/* Tab content */}
            <View style={styles.tabContent}>
              {activeTab === "Memories" && renderMemories()}
              {activeTab === "Gallery" && renderGallery()}
              {activeTab === "Videos" && renderVideos()}
              {activeTab === "Audio" && renderAudio()}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDE8E1",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDE8E1",
  },
  loadingText: {
    marginTop: 12,
    color: "#8A827A",
    fontSize: 16,
  },
  error: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDE8E1",
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.ink700,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.ink500,
    textAlign: "center",
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: "#6cab90",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Top section
  topSection: {
    backgroundColor: "#EDE8E1",
    alignItems: "center",
    paddingBottom: 28,
    overflow: "hidden",
  },
  backBtn: {
    position: "absolute",
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  greenArc: {
    position: "absolute",
    top: -20,
    width: SCREEN_W * 1.4,
    height: 200,
    borderRadius: SCREEN_W * 0.7,
    backgroundColor: "rgba(108,171,144,0.12)",
    alignSelf: "center",
  },
  avatarWrapper: {
    marginTop: 80,
  },
  avatarGradientRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 6,
  },
  avatarWhiteRing: {
    width: "100%",
    height: "100%",
    borderRadius: 64,
    backgroundColor: "#fff",
    padding: 4,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  avatarFallback: {
    backgroundColor: Colors.green700,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: "700",
    color: "#fff",
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.ink700,
    marginTop: 16,
    textAlign: "center",
  },
  bio: {
    fontSize: 16,
    color: Colors.ink500,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  lifeYears: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.green700,
    letterSpacing: 1,
    marginTop: 6,
    textAlign: "center",
  },

  // Pluk post banner
  plukBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#f0f7f4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c8e6d8",
    padding: 16,
  },
  plukBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  plukBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3d7a62",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  plukBannerDesc: {
    fontSize: 15,
    color: Colors.ink700,
    lineHeight: 22,
    marginTop: 4,
  },
  plukErrorBox: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 10,
  },
  plukErrorText: {
    fontSize: 13,
    color: Colors.ink400,
    textAlign: "center",
    lineHeight: 19,
  },
  plukSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3d7a62",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
  },
  plukThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 8,
  },
  plukVideoThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },

  // Pluk-only footer note
  plukFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 40,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f0f7f4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8e6d8",
  },
  plukFooterText: {
    fontSize: 13,
    color: Colors.green700,
    fontWeight: "500",
    flexShrink: 1,
  },

  // Sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 32,
    flex: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 50,
    overflow: "hidden",
  },
  tabBtnActive: {},
  tabBtnActiveInner: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 50,
    shadowColor: "#6cab90",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabLabel: {
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 14,
    color: Colors.ink500,
    fontWeight: "500",
  },
  tabLabelActive: {
    fontSize: 14,
    color: Colors.ink700,
    fontWeight: "700",
  },

  // Green accent line
  accentLine: {
    marginBottom: 18,
    height: 2,
    overflow: "hidden",
    borderRadius: 2,
  },
  accentLineGrad: {
    height: 2,
    width: "100%",
  },

  tabContent: { flex: 1, paddingHorizontal: 20 },

  // Memory card
  memoryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  photoGrid: {
    position: "relative",
  },
  photoItem: {
    width: "50%",
    aspectRatio: 1,
  },
  photoSingle: {
    width: "100%",
    aspectRatio: 1.5,
  },
  photoWide: {
    width: "100%",
    aspectRatio: 0.75,
  },
  photoGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
  },
  dateBadgeDay: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  memoryCardBody: {
    padding: 16,
  },
  memoryCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  memoryMeta: {
    flex: 1,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 4,
  },
  memoryDate: {
    fontSize: 14,
    color: Colors.ink500,
  },
  memoryDesc: {
    fontSize: 14,
    color: Colors.ink600,
    lineHeight: 20,
  },

  // Gallery
  masonryRow: {
    flexDirection: "row",
    gap: 8,
  },
  masonryCol: {
    flex: 1,
    gap: 8,
  },
  masonryPhoto: {
    borderRadius: 12,
    backgroundColor: Colors.ink100,
  },

  // Video grid
  videoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 16,
  },
  videoThumb: {
    width: "48%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
  },
  videoThumbInner: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    justifyContent: "center",
    alignItems: "center",
  },

  // Audio list
  audioList: {
    paddingBottom: 16,
  },

  // Empty states
  emptyBox: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink500,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.ink400,
    textAlign: "center",
  },
});
