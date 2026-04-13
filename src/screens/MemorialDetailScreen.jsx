import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { memorialService } from "../services";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const TABS = ["Memories", "Gallery", "Audio"];

export default function MemorialDetailScreen({ route, navigation }) {
  const { memorialId } = route.params || {};
  const [memorial, setMemorial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Memories");

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
            {memorial.videos?.length > 0 || memorial.description ? (
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
      case "Audio":
        return (
          <View style={styles.tabContent}>
            {memorial.audios?.length > 0 ? (
              memorial.audios.map((uri, idx) => (
                <View key={idx} style={styles.audioItem}>
                  <View style={styles.audioPlayBtn}>
                    <Text style={styles.audioPlayIcon}>▶</Text>
                  </View>
                  <View style={styles.audioWave}>
                    {[...Array(16)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.audioBar,
                          { height: 6 + Math.sin(i * 0.8) * 10 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.audioDuration}>0:12</Text>
                </View>
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
          <Text style={styles.navBtnText}>←</Text>
        </TouchableOpacity>
        <AppLogo size={32} />
        <View style={{ flex: 1 }} />
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn}>
            <Text style={styles.navBtnText}>⊞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <Text style={styles.navBtnText}>⋮</Text>
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
});
