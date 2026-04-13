import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { authService, memorialService } from "../services";
import { isFirebaseConfigured } from "../config/firebase";
import { Colors } from "../theme/colors";

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
const AVATAR_SIZE = 120;

const DEMO_MEMORIALS = [
  {
    id: "demo-memorial-1",
    title: "Eleanor Grace",
    description:
      "Today was perfect. Surrounded by the people I love, laughing, reminiscing, and just soaking it all in. Life has been good, and today was a beautiful reminder of that.",
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

const TABS = ["Memories", "Gallery", "Audio"];

function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ProfileScreen({ navigation }) {
  const user = authService.getCurrentUser();
  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0]?.replace(/[._]/g, " ") ||
    "User";
  const [profileName, setProfileName] = useState(displayName);
  const [bio, setBio] = useState(
    "Artist, educator, and devoted mother—painting life's canvas with love and color.",
  );
  const [avatar, setAvatar] = useState(null);
  const [activeTab, setActiveTab] = useState("Memories");
  const [memorials, setMemorials] = useState(
    isFirebaseConfigured ? [] : DEMO_MEMORIALS,
  );
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setProfileName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const userId = user?.uid;
    if (!userId) return;
    setLoading(true);
    memorialService.getUserMemorials(userId).then((result) => {
      if (result.success) setMemorials(result.memorials);
      setLoading(false);
    });
  }, []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri)
      setAvatar(result.assets[0].uri);
  };

  const signOut = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await authService.signOutUser();
        },
      },
    ]);
  };

  const allPhotos = memorials.flatMap((m) => m.photos || []);
  const allAudios = memorials.flatMap((m) => m.audios || []);

  const renderMemories = () => {
    if (loading)
      return (
        <ActivityIndicator color={Colors.green700} style={{ marginTop: 30 }} />
      );
    if (memorials.length === 0)
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="flower-outline"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>Start by adding a memory</Text>
        </View>
      );

    return memorials.map((item) => {
      const raw = item.createdAt;
      const date =
        raw instanceof Date ? raw : raw?.toDate ? raw.toDate() : new Date();
      const day = date.getDate();
      const month = MONTHS[date.getMonth()];
      const fullDate = `${month} ${day}, ${date.getFullYear()}`;

      return (
        <TouchableOpacity
          key={item.id}
          style={styles.memoryCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Detail", { memorialId: item.id })}
        >
          {/* Photos with date badge overlaid top-left */}
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
              {/* Date badge overlaid on top-left of photo */}
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

          {/* Caption at bottom */}
          <View style={styles.memoryCardBody}>
            <View style={styles.memoryCardRow}>
              <View style={styles.memoryMeta}>
                <Text style={styles.memoryTitle}>{item.title}</Text>
                <Text style={styles.memoryDate}>{fullDate}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={Colors.ink300}
              />
            </View>
            {item.description ? (
              <Text style={styles.memoryDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    });
  };

  const renderGallery = () => {
    if (allPhotos.length === 0)
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="image-off-outline"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>No photos yet</Text>
        </View>
      );
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

  const renderAudio = () => {
    if (allAudios.length === 0)
      return (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="music-off"
            size={44}
            color={Colors.ink300}
          />
          <Text style={styles.emptyTitle}>No audio yet</Text>
        </View>
      );
    return allAudios.map((uri, idx) => (
      <View key={idx} style={styles.audioItem}>
        <LinearGradient
          colors={["#6cab90", "#3d7a62"]}
          style={styles.audioPlayBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="play" size={18} color={Colors.white} />
        </LinearGradient>
        <View style={styles.audioWave}>
          {[...Array(22)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.audioBar,
                { height: 5 + Math.abs(Math.sin(i * 0.6)) * 16 },
              ]}
            />
          ))}
        </View>
        <Text style={styles.audioDuration}>0:12</Text>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {showMenu && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        />
      )}
      {showMenu && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowMenu(false);
              navigation.navigate("EditProfile", {
                currentName: profileName,
                currentBio: bio,
              });
            }}
          >
            <MaterialCommunityIcons
              name="account-edit"
              size={20}
              color={Colors.ink700}
            />
            <Text style={styles.dropdownText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowMenu(false);
              navigation.navigate("Settings");
            }}
          >
            <MaterialCommunityIcons
              name="cog"
              size={20}
              color={Colors.ink700}
            />
            <Text style={styles.dropdownText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dropdownItem, styles.dropdownItemDestructive]}
            onPress={() => {
              setShowMenu(false);
              signOut();
            }}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#dc3545" />
            <Text style={[styles.dropdownText, styles.dropdownTextDestructive]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cream top section */}
        <View style={styles.topSection}>
          {/* Top nav */}
          <View style={styles.topNav}>
            <View style={styles.navLeft}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => navigation.goBack()}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={20}
                  color={Colors.ink700}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.navTitle}>My Profile</Text>
            <View style={styles.navRight}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => navigation.navigate("GenerateQR")}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={Colors.ink700}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setShowMenu(!showMenu)}
              >
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={20}
                  color={Colors.ink700}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Decorative green arc */}
          <View style={styles.greenArc} />

          {/* Avatar centered */}
          <View style={styles.avatarWrapper}>
            {/* Outer decorative ring */}
            <LinearGradient
              colors={["#6cab90", "#3d7a62", "#b8d9cb"]}
              style={styles.avatarGradientRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* White gap ring */}
              <View style={styles.avatarWhiteRing}>
                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
                  <Image
                    source={{
                      uri:
                        avatar ||
                        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80",
                    }}
                    style={styles.avatarImage}
                  />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Camera badge */}
            <TouchableOpacity style={styles.cameraBadge} onPress={pickAvatar}>
              <LinearGradient
                colors={["#6cab90", "#3d7a62"]}
                style={styles.cameraBadgeGrad}
              >
                <MaterialCommunityIcons name="camera" size={13} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Name */}
          <Text style={styles.name}>{profileName}</Text>

          {/* Decorative dot row */}
          <View style={styles.dotRow}>
            <View style={[styles.dot, styles.dotSmall]} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotGreen]} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotSmall]} />
          </View>

          {/* Bio */}
          <Text style={styles.bio}>{bio}</Text>
        </View>

        {/* White card sheet */}
        <View style={styles.sheet}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => (
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

          {/* Green accent line under active tab */}
          <View style={styles.accentLine}>
            <LinearGradient
              colors={["transparent", "#6cab90", "transparent"]}
              style={styles.accentLineGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>

          {/* Content */}
          <View style={styles.tabContent}>
            {activeTab === "Memories" && renderMemories()}
            {activeTab === "Gallery" && renderGallery()}
            {activeTab === "Audio" && renderAudio()}
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

  // Cream top section
  topSection: {
    backgroundColor: "#EDE8E1",
    alignItems: "center",
    paddingBottom: 28,
    overflow: "hidden",
  },

  // Subtle green arc decoration behind avatar
  greenArc: {
    position: "absolute",
    top: -20,
    width: SCREEN_W * 1.4,
    height: 200,
    borderRadius: SCREEN_W * 0.7,
    backgroundColor: "rgba(108,171,144,0.12)",
    alignSelf: "center",
  },

  // Top nav
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 24,
    zIndex: 10,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.ink700,
    letterSpacing: 0.3,
  },
  navRight: {
    flexDirection: "row",
    gap: 8,
    minWidth: 88,
    justifyContent: "flex-end",
  },
  navLeft: { flexDirection: "row", minWidth: 88 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Avatar
  avatarWrapper: {
    position: "relative",
    marginBottom: 20,
  },
  avatarGradientRing: {
    width: AVATAR_SIZE + 12,
    height: AVATAR_SIZE + 12,
    borderRadius: (AVATAR_SIZE + 12) / 2,
    padding: 3,
    shadowColor: "#6cab90",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  avatarWhiteRing: {
    flex: 1,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    backgroundColor: "#fff",
    padding: 3,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: AVATAR_SIZE / 2,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 4,
    right: 2,
    zIndex: 10,
  },
  cameraBadgeGrad: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  // Name
  name: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.ink700,
    textAlign: "center",
    textTransform: "capitalize",
    letterSpacing: 0.2,
    marginBottom: 10,
  },

  // Decorative dots
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.ink300,
  },
  dotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink300,
    opacity: 0.5,
  },
  dotGreen: {
    backgroundColor: "#6cab90",
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Bio
  bio: {
    fontSize: 13.5,
    color: Colors.ink500,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 36,
  },

  // White sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 0,
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 50,
    minHeight: 500,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F0EBE4",
    borderRadius: 50,
    padding: 4,
    marginBottom: 6,
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

  tabContent: { flex: 1 },

  // Memory card
  memoryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#6cab90",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.1)",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    position: "relative",
  },
  photoItem: {
    width: "49.5%",
    aspectRatio: 1,
    backgroundColor: Colors.ink100,
  },
  photoSingle: { width: "100%", aspectRatio: 16 / 9 },
  photoWide: { width: "100%", aspectRatio: 2 },
  photoGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  memoryCardBody: {
    padding: 14,
  },
  memoryCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  dateBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 46,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dateBadgeDay: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dateBadgeMonth: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    marginTop: 2,
  },
  memoryMeta: { flex: 1 },
  memoryTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  memoryDate: { fontSize: 11, color: Colors.ink500, marginTop: 2 },
  memoryDesc: { fontSize: 13, color: Colors.ink500, lineHeight: 19 },

  // Gallery
  masonryRow: { flexDirection: "row", gap: 4 },
  masonryCol: { flex: 1, gap: 4 },
  masonryPhoto: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: Colors.ink100,
  },

  // Audio
  audioItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F6F2",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.15)",
  },
  audioPlayBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  audioWave: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
  audioBar: {
    width: 2.5,
    backgroundColor: "#6cab90",
    borderRadius: 2,
    opacity: 0.65,
  },
  audioDuration: { fontSize: 12, color: Colors.ink500, fontWeight: "600" },

  // Empty
  emptyBox: { paddingVertical: 50, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink500 },
  emptyText: { fontSize: 13, color: Colors.ink300 },

  // Overlay for closing dropdown
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },

  // Dropdown Menu
  dropdownMenu: {
    position: "absolute",
    top: 100,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(108,171,144,0.1)",
    minWidth: 160,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  dropdownItemDestructive: {
    borderTopWidth: 1,
    borderTopColor: "rgba(108,171,144,0.1)",
    marginTop: 8,
    paddingTop: 16,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.ink700,
    fontWeight: "500",
  },
  dropdownTextDestructive: {
    color: "#dc3545",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink700,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#F4F0EB",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.ink700,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "#6cab90",
  },
  modalButtonSecondary: {
    backgroundColor: "#F0EBE4",
  },
  modalButtonText: {
    color: Colors.ink700,
    fontWeight: "700",
  },
  modalButtonTextPrimary: {
    color: "#fff",
  },
});
