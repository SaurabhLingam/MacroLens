import React, { useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { Text } from "../components/TextWrapper";

const GRAD_PRIMARY = ["#B148FF", "#F6339B", "#9914F9"];

/**
 * Props
 *   subtitle        – body text
 *   btnLabel        – CTA label
 *   streakDays      – current streak count (default: 3)
 *   requiredDays    – days needed to unlock (default: 5)
 *   onPress         – optional CTA handler
 *   style           – extra style on outer wrap
 */
export default function WellnessInsightsCard({
  subtitle = "Keep up your streak to unlock personalized wellness data.",
  btnLabel = "Learn How it Works",
  streakDays = 3,
  requiredDays = 5,
  onPress,
  style,
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const progress = Math.min(streakDays / requiredDays, 1);
  const daysLeft = Math.max(requiredDays - streakDays, 0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1100,
        delay: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[styles.outerWrap, { opacity: fadeAnim }, style]}>
      <View style={styles.card}>
        {/* Background image */}
        <ImageBackground
          source={require("../../assets/bg.webp")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {/* Light overlay to keep content readable */}
          <LinearGradient
            colors={["rgba(255,255,255,0.82)", "rgba(255,255,255,0.92)"]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>

        {/* Top border accent */}
        <LinearGradient
          colors={[
            "rgba(177,72,255,0.6)",
            "rgba(246,51,155,0.4)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topAccent}
          pointerEvents="none"
        />

        {/* Content */}
        <View style={styles.inner}>
          {/* Badge */}
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text weight="600" style={styles.badgeText}>
              HELIX AI
            </Text>
          </View>

          {/* Gradient title */}
          <MaskedView
            maskElement={
              <Text weight="800" style={styles.titleMask}>
                Wellness{"\n"}Insights
              </Text>
            }
          >
            <LinearGradient
              colors={GRAD_PRIMARY}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.titleGradientSizer}
            />
          </MaskedView>

          {/* Subtitle */}
          <Text weight="400" style={styles.subtitle}>
            {subtitle}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text weight="500" style={styles.progressLabel}>
                Tracking progress
              </Text>
              <Text weight="600" style={styles.progressCount}>
                {streakDays} / {requiredDays} days
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: progressWidth }]}
              >
                <LinearGradient
                  colors={GRAD_PRIMARY}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 100 }}
                />
              </Animated.View>
            </View>
          </View>

          {/* Stat pills */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text weight="400" style={styles.statText}>
                <Text weight="600" style={styles.statTextBold}>
                  {streakDays}-day
                </Text>{" "}
                streak
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statEmoji}>⚡</Text>
              <Text weight="400" style={styles.statText}>
                <Text weight="600" style={styles.statTextBold}>
                  {daysLeft} more
                </Text>{" "}
                days left
              </Text>
            </View>
          </View>

          {/* Divider */}
          <LinearGradient
            colors={[
              "rgba(177,72,255,0.3)",
              "rgba(246,51,155,0.15)",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.divider}
          />

          {/* CTA Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={styles.btnWrap}
          >
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <LinearGradient
                colors={GRAD_PRIMARY}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.btn}
              >
                <Text weight="700" style={styles.btnLabel}>
                  {btnLabel}
                </Text>
                <View style={styles.btnArrow}>
                  <Text weight="700" style={styles.btnArrowText}>
                    →
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(177,72,255,0.15)",
    overflow: "hidden",
    // Light shadow
  },
  topAccent: {
    height: 1.5,
    width: "100%",
  },
  inner: {
    padding: 24,
    paddingTop: 20,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(177,72,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(177,72,255,0.22)",
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#b148ff",
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: "#9914F9",
  },

  // Title
  titleMask: {
    fontSize: 30,
    lineHeight: 34,
    color: "#000",
    letterSpacing: -0.5,
  },
  titleGradientSizer: {
    height: 72,
    width: 220,
  },

  // Subtitle
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(30,20,50,0.52)",
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 280,
  },

  // Progress
  progressSection: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: "rgba(30,20,50,0.45)",
  },
  progressCount: {
    fontSize: 12,
    color: "#9914F9",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(177,72,255,0.1)",
    borderRadius: 100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
    overflow: "hidden",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(177,72,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(177,72,255,0.12)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statEmoji: {
    fontSize: 14,
  },
  statText: {
    fontSize: 12,
    color: "rgba(30,20,50,0.55)",
  },
  statTextBold: {
    fontSize: 12,
    color: "rgba(30,20,50,0.85)",
  },

  // Divider
  divider: {
    height: 1,
    marginBottom: 20,
    marginHorizontal: -24,
  },

  // Button
  btnWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 14,
  },
  btnLabel: {
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.1,
  },
  btnArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnArrowText: {
    fontSize: 12,
    color: "#fff",
  },
});
