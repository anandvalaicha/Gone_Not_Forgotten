import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  Text,
  Animated,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const { width: W, height: H } = Dimensions.get("window");

// A URI is playable if it's http(s) or a local file
const isPlayableUri = (u) =>
  typeof u === "string" &&
  u.trim().length > 0 &&
  (u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("file://") ||
    u.startsWith("content://"));

export default function VideoPlayerModal({ uri, onClose }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSecs, setPositionSecs] = useState(0);
  const [durationSecs, setDurationSecs] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [loadError, setLoadError] = useState(!isPlayableUri(uri));

  // Pass URI as a plain string — expo-video v3 accepts both string and {uri} object
  // but string is more reliable across web and native
  const player = useVideoPlayer(isPlayableUri(uri) ? uri : null, (p) => {
    p.play();
  });

  // Sync muted toggle to player
  useEffect(() => {
    if (player) player.muted = isMuted;
  }, [isMuted]);

  // Schedule first hide and set up playToEnd listener on mount
  useEffect(() => {
    if (!player) return;
    fadeAnim.setValue(1);
    scheduleHide();
    const endSub = player.addListener("playToEnd", () => {
      setIsPlaying(false);
      revealControls();
    });
    // Detect player error (e.g. unreachable source)
    const statusSub = player.addListener("statusChange", (status) => {
      if (status?.status === "error" || status?.error) {
        setLoadError(true);
      }
    });
    return () => {
      endSub.remove();
      statusSub?.remove?.();
      clearTimeout(hideTimer.current);
      player.pause();
    };
  }, []);

  // Poll progress every 250 ms
  useEffect(() => {
    const id = setInterval(() => {
      setPositionSecs(player.currentTime || 0);
      setDurationSecs(player.duration || 0);
      setIsPlaying(player.playing);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    }, 3000);
  }, [fadeAnim]);

  const revealControls = () => {
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    scheduleHide();
  };

  const handleTap = () => {
    if (!showControls) revealControls();
    else togglePlay();
  };

  const togglePlay = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      if (durationSecs > 0 && positionSecs >= durationSecs - 0.1) {
        player.currentTime = 0;
      }
      player.play();
      setIsPlaying(true);
    }
    revealControls();
  };

  const handleClose = () => {
    player?.pause();
    clearTimeout(hideTimer.current);
    onClose();
  };

  const seek = (frac) => {
    if (!player || !durationSecs) return;
    player.currentTime = frac * durationSecs;
    revealControls();
  };

  const progress = durationSecs > 0 ? positionSecs / durationSecs : 0;

  const fmt = (secs) => {
    const s = Math.floor(secs || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <Modal visible animationType="fade" onRequestClose={handleClose}>
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Error / unavailable state */}
        {loadError ? (
          <View style={styles.errorContainer}>
            <TouchableOpacity
              style={styles.closeAbsolute}
              onPress={handleClose}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={26}
                color="#fff"
              />
            </TouchableOpacity>
            <MaterialCommunityIcons
              name="video-off-outline"
              size={56}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.errorText}>Video unavailable</Text>
            <Text style={styles.errorSub}>
              This video was not uploaded to cloud storage.{"\n"}Please delete
              and re-add the video.
            </Text>
          </View>
        ) : (
          <>
            {/* Video layer — fills screen */}
            <TouchableWithoutFeedback onPress={handleTap}>
              <View style={StyleSheet.absoluteFill}>
                {uri && player && (
                  <VideoView
                    player={player}
                    style={styles.videoFill}
                    contentFit="cover"
                    nativeControls={false}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>

            {/* Overlay controls — fade in/out */}
            {showControls && (
              <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {/* Top bar */}
                <View style={styles.topBar}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={handleClose}
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={26}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      setIsMuted((m) => !m);
                      revealControls();
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isMuted ? "volume-off" : "volume-high"}
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {/* Centre play/pause button */}
                <TouchableOpacity
                  style={styles.centreBtn}
                  onPress={togglePlay}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? "pause" : "play"}
                    size={44}
                    color="#fff"
                    style={{ marginLeft: isPlaying ? 0 : 4 }}
                  />
                </TouchableOpacity>

                {/* Bottom bar — progress + time */}
                <View style={styles.bottomBar}>
                  <Text style={styles.timeText}>{fmt(positionSecs)}</Text>

                  {/* Scrub bar — tap to seek */}
                  <TouchableWithoutFeedback
                    onPress={(e) => {
                      const tapX = e.nativeEvent.locationX;
                      const barWidth = W - 32 - 80;
                      seek(Math.min(1, Math.max(0, tapX / barWidth)));
                    }}
                  >
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(progress * 100)}%` },
                        ]}
                      />
                      {/* Scrub handle */}
                      <View
                        style={[
                          styles.scrubHandle,
                          {
                            left: `${Math.round(progress * 100)}%`,
                            marginLeft: -6,
                          },
                        ]}
                      />
                    </View>
                  </TouchableWithoutFeedback>

                  <Text style={styles.timeText}>{fmt(durationSecs)}</Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  closeAbsolute: {
    position: "absolute",
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  errorSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  videoFill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: W,
    height: H,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  // Top dark gradient area
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  // Centre play/pause
  centreBtn: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 36,
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  scrubHandle: {
    position: "absolute",
    top: -5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
});
