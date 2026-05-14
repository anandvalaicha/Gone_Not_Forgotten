import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import AppLogo from "../components/AppLogo";

const { height } = Dimensions.get("window");

// ─── TIMING (total ≈ 6.9 s) ──────────────────────────────────────────────────
// 0.0 – 1.5 s  background fades in
// 0.0 – 7.0 s  background slowly zooms in (Ken Burns)
// 1.5 – 2.3 s  golden glow overlay fades in
// 2.3 – 3.0 s  logo + teal halo appear
// 3.0 – 3.6 s  title slides up
// 3.6 – 4.4 s  divider + tagline appear
// 4.4 – 6.1 s  hold (glow continues pulsing)
// 6.1 – 6.9 s  screen fades to black → onFinish

export default function SplashScreen({ onFinish }) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const bgScale = useRef(new Animated.Value(1.0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(32)).current;
  const dividerOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ken Burns zoom – runs in parallel with the whole sequence
    Animated.timing(bgScale, {
      toValue: 1.08,
      duration: 7000,
      useNativeDriver: true,
    }).start();

    // Main cinematic sequence
    Animated.sequence([
      // Phase 1 – background fades in [0 → 1.5 s]
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      // Phase 2 – warm glow overlay appears [1.5 → 2.3 s]
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Phase 3 – logo rises [2.3 → 3.0 s]
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 35,
          useNativeDriver: true,
        }),
      ]),
      // Phase 4 – title slides up [3.0 → 3.6 s]
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Phase 5 – divider + tagline [3.6 → 4.4 s]
      Animated.parallel([
        Animated.timing(dividerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Hold [4.4 → 6.1 s]
      Animated.delay(1700),
      // Phase 6 – fade to black [6.1 → 6.9 s]
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());

    // Soft glow pulse loop – begins once the overlay is visible (~2.3 s)
    const pulseTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.55,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, 2300);

    return () => clearTimeout(pulseTimer);
  }, []);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: screenOpacity }]}
    >
      {/* ── Background image with Ken Burns zoom ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}
      >
        <Animated.Image
          source={require("../../assets/animation_background.png")}
          style={[
            StyleSheet.absoluteFill,
            styles.bgImage,
            { opacity: bgOpacity },
          ]}
          resizeMode="cover"
        />
      </Animated.View>

      {/* ── Dark scrim so text stays readable ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.darkScrim,
          { opacity: bgOpacity },
        ]}
      />

      {/* ── Warm golden glow (simulates sunset light brightening) ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: Animated.multiply(glowOpacity, glowPulse) },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,190,60,0.07)",
            "rgba(255,155,30,0.20)",
            "rgba(210,110,15,0.32)",
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.15 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* ── Main content ── */}
      <View style={styles.content}>
        {/* Logo + teal glow halo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          {/* Teal radial glow behind the logo */}
          <Animated.View
            style={[styles.logoGlowHalo, { opacity: glowPulse }]}
          />
          <AppLogo size={110} tintColor="#FFFFFF" />
        </Animated.View>

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
            },
          ]}
        >
          Gone Not{"\n"}Forgotten
        </Animated.Text>

        {/* Divider */}
        <Animated.View style={[styles.dividerRow, { opacity: dividerOpacity }]}>
          <View style={styles.dividerLine} />
          <Text style={styles.heart}>♥</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          WHERE MEMORIES LIVE FOREVER
        </Animated.Text>
      </View>

      {/* ── Bottom vignette for depth ── */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        style={styles.bottomVignette}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    width: "100%",
    height: "100%",
  },
  darkScrim: {
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlowHalo: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(77, 148, 120, 0.22)",
    shadowColor: Colors.green500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 45,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
    marginTop: 22,
    lineHeight: 48,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    width: 220,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.50)",
  },
  heart: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    marginHorizontal: 8,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 3.5,
    marginTop: 10,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bottomVignette: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.28,
  },
  // ── legacy styles kept for shape ──────────────────────────────────────────
  subtitle: {
    fontSize: 15,
    color: Colors.ink700,
    marginTop: 8,
  },
});
