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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { memorialService, authService } from "../services";
import { isSupabaseConfigured } from "../config/supabase";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const { width: SCREEN_W } = Dimensions.get("window");
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
  const { userId, access } = route.params || {};
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Memories");

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  const isSectionAllowed = (section) => {
    if (!userProfile) return false;
    const publicKey = {
      bio: "showBio",
      memories: "showMemories",
      gallery: "showGallery",
    }[section];

    if (!userProfile[publicKey]) return false;
    if (!access || access.length === 0) return true;
    return access.includes(section);
  };

  const loadUserProfile = async () => {
    try {
      if (!isSupabaseConfigured) {
        // Demo mode
        setUserProfile(DEMO_USER_PROFILE);
        setLoading(false);
        return;
      }

      // In a real app, you'd fetch user profile settings and public data
      // For now, we'll show a demo profile
      setUserProfile(DEMO_USER_PROFILE);
      setLoading(false);
    } catch (error) {
      Alert.alert("Error", "Could not load user profile");
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
        raw instanceof Date ? raw : raw?.toDate ? raw.toDate() : new Date();
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
            <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          {/* App logo */}
          <View style={{ position: "absolute", top: 56, right: 20 }}>
            <AppLogo size={32} tintColor="#fff" />
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
                <Image
                  source={{ uri: userProfile.avatar }}
                  style={styles.avatarImage}
                />
              </View>
            </LinearGradient>
          </View>

          {/* Name */}
          <Text style={styles.name}>{userProfile.displayName}</Text>

          {/* Bio - only show if user allows */}
          {isSectionAllowed("bio") && userProfile.bio && (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.sheet}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {["Memories", "Gallery"].map((tab) => (
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
          </View>
        </View>
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
// </content>
<parameter name="filePath">
  /Users/anandvalaicha/GoneNotForgotten/src/screens/UserProfileScreen.jsx
</parameter>;
