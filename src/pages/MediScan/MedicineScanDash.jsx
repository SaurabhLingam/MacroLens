import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Text } from "../../components/TextWrapper";

const { width } = Dimensions.get("window");

// ─── Design tokens (purple system — unchanged) ────────────────────────────────
const P = {
  primary:     "#0D7A6F",
  primaryDark: "#085C53",
  primaryMid:  "#0F9185",
  primarySoft: "#2BADA0",
  ghostLight:  "#E6F5F4",
  ghostMid:    "#D0EEEC",
  ghostBorder: "#9FD6D1",
  amber:       "#F59E0B",
  red:         "#EF4444",
  green:       "#10B981",
  surface:     "#F0FAF9",
  white:       "#FFFFFF",
  text:        "#0A1F1E",
  textSub:     "#2C4F4C",
  textMuted:   "#6A9E99",
};

// ─── Component ─────────────────────────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0.5)).current;
  const fadeIn       = useRef(new Animated.Value(0)).current;
  const heroSlide    = useRef(new Animated.Value(24)).current;
  const cardSlide1   = useRef(new Animated.Value(40)).current;
  const cardSlide2   = useRef(new Animated.Value(40)).current;
  const dotPulse     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry sequence
    Animated.parallel([
      Animated.timing(fadeIn,    { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
    Animated.spring(cardSlide1, { toValue: 0, friction: 8, tension: 60, delay: 180, useNativeDriver: true }).start();
    Animated.spring(cardSlide2, { toValue: 0, friction: 8, tension: 60, delay: 300, useNativeDriver: true }).start();

    // Scan line — the one signature animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 140, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0,   duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse on scan line
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Dot pulse for live indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera roll access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
      });
      if (!result.canceled && result.assets?.length > 0) {
        navigation.navigate("MediTrackResult", { imageUri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to upload image: " + error.message);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO BLOCK: dark gradient + phone mockup side by side ─────────── */}
        <LinearGradient
          colors={[P.primaryDark, P.primary, P.primarySoft + "CC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroBlock}
        >
          {/* Back button + badge row */}
          <View style={s.heroTopRow}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={P.white} />
            </TouchableOpacity>

            <View style={s.liveBadge}>
              <Animated.View style={[s.liveDot, { transform: [{ scale: dotPulse }] }]} />
              <Text weight="700" style={s.liveBadgeText}>AI POWERED</Text>
            </View>
          </View>

          {/* Hero content row */}
          <Animated.View style={[s.heroContentRow, { opacity: fadeIn, transform: [{ translateY: heroSlide }] }]}>
            {/* Text side */}
            <View style={s.heroTextSide}>
              <View style={s.heroPill}>
                <MaterialCommunityIcons name="pill" size={11} color={P.teal} />
                <Text weight="700" style={s.heroPillText}>Know Your Medicine</Text>
              </View>
              <Text weight="800" style={s.heroHeading}>Identify{"\n"}Any Med{"\n"}Instantly</Text>
              <Text style={s.heroSub}>Point your camera at any medicine packet for instant AI analysis</Text>
            </View>

            {/* Phone mockup side */}
            <View style={s.phoneSide}>
              <View style={s.phone}>
                <View style={s.phoneSpeaker} />
                <View style={s.phoneScreen}>
                  {/* Scan corners */}
                  <View style={s.cornerTL} /><View style={s.cornerTR} />
                  <View style={s.cornerBL} /><View style={s.cornerBR} />
                  <Animated.View style={{ opacity: glowAnim }}>
                    <MaterialCommunityIcons name="pill" size={38} color={P.primarySoft} />
                  </Animated.View>
                  <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />
                </View>
                <View style={s.phoneHome} />
              </View>
              {/* Floating tip */}
              <View style={s.floatingTip}>
                <MaterialCommunityIcons name="check-circle" size={12} color={P.teal} />
                <Text style={s.floatingTipText}>Good lighting</Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ── CURVED CUTOUT ─────────────────────────────────────────────────── */}
        <View style={s.heroTail} />

        {/* ── ACTION CARDS — full-width, bold left stripe ───────────────────── */}
        <View style={s.actionSection}>
          <Text weight="800" style={s.sectionLabel}>GET STARTED</Text>

          {/* Scan card */}
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: cardSlide1 }] }}>
            <TouchableOpacity
              style={s.bigCard}
              onPress={() => navigation.navigate("MediTrackScanner")}
              activeOpacity={0.87}
            >
              <LinearGradient
                colors={[P.coral, "#FF8E53"]}
                style={s.bigCardStripe}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <MaterialCommunityIcons name="camera" size={26} color={P.white} />
              </LinearGradient>
              <View style={s.bigCardBody}>
                <Text weight="800" style={s.bigCardTitle}>Scan Medicine</Text>
                <Text style={s.bigCardDesc}>Use your camera for real-time packet recognition</Text>
                <View style={s.bigCardMeta}>
                  <View style={[s.metaChip, { backgroundColor: P.coral + "15" }]}>
                    <MaterialCommunityIcons name="flash" size={10} color={P.coral} />
                    <Text style={[s.metaChipText, { color: P.coral }]}>Instant</Text>
                  </View>
                  <View style={[s.metaChip, { backgroundColor: P.coral + "15" }]}>
                    <MaterialCommunityIcons name="cellphone" size={10} color={P.coral} />
                    <Text style={[s.metaChipText, { color: P.coral }]}>Live view</Text>
                  </View>
                </View>
              </View>
              <View style={[s.bigCardArrow, { backgroundColor: P.coral }]}>
                <MaterialCommunityIcons name="arrow-right" size={18} color={P.white} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Upload card */}
          <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: cardSlide2 }] }}>
            <TouchableOpacity
              style={s.bigCard}
              onPress={handleUpload}
              activeOpacity={0.87}
            >
              <LinearGradient
                colors={[P.lavender, P.primarySoft]}
                style={s.bigCardStripe}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <MaterialCommunityIcons name="image-plus" size={26} color={P.white} />
              </LinearGradient>
              <View style={s.bigCardBody}>
                <Text weight="800" style={s.bigCardTitle}>Upload Image</Text>
                <Text style={s.bigCardDesc}>Pick a photo from your library and analyse it</Text>
                <View style={s.bigCardMeta}>
                  <View style={[s.metaChip, { backgroundColor: P.lavender + "18" }]}>
                    <MaterialCommunityIcons name="image" size={10} color={P.lavender} />
                    <Text style={[s.metaChipText, { color: P.lavender }]}>Gallery</Text>
                  </View>
                  <View style={[s.metaChip, { backgroundColor: P.lavender + "18" }]}>
                    <MaterialCommunityIcons name="shield-lock" size={10} color={P.lavender} />
                    <Text style={[s.metaChipText, { color: P.lavender }]}>Private</Text>
                  </View>
                </View>
              </View>
              <View style={[s.bigCardArrow, { backgroundColor: P.lavender }]}>
                <MaterialCommunityIcons name="arrow-right" size={18} color={P.white} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── HOW IT WORKS — horizontal steps with connecting line ──────────── */}
        <View style={s.stepsSection}>
          <Text weight="800" style={s.sectionLabel}>HOW IT WORKS</Text>

          <View style={s.stepsTrack}>
            {/* Connecting line behind the icons */}
            <View style={s.trackLine} />

            {[
              { num: "1", icon: "line-scan",            label: "Scan",    sub: "Point at packet",  accent: P.coral },
              { num: "2", icon: "cpu-64-bit",           label: "Analyse", sub: "AI processes it",  accent: P.amber },
              { num: "3", icon: "text-box-check-outline", label: "Results", sub: "Info displayed", accent: P.primary },
            ].map((step, i) => (
              <View key={i} style={s.stepItem}>
                <View style={[s.stepCircle, { backgroundColor: step.accent, shadowColor: step.accent }]}>
                  <MaterialCommunityIcons name={step.icon} size={22} color={P.white} />
                </View>
                <View style={[s.stepNumBadge, { backgroundColor: step.accent + "22", borderColor: step.accent + "55" }]}>
                  <Text weight="800" style={[s.stepNumText, { color: step.accent }]}>{step.num}</Text>
                </View>
                <Text weight="700" style={s.stepLabel}>{step.label}</Text>
                <Text style={s.stepSub}>{step.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── TRUST ROW — minimal, inside a dark chip strip ─────────────────── */}
        <LinearGradient
          colors={[P.primaryDark + "F0", P.primary + "F0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.trustStrip}
        >
          {[
            { icon: "shield-check", label: "Verified", color: P.teal },
            { icon: "flash",        label: "Instant",  color: P.gold },
            { icon: "lock",         label: "Private",  color: P.lavender },
          ].map((item, i) => (
            <View key={i} style={s.trustItem}>
              <MaterialCommunityIcons name={item.icon} size={16} color={item.color} />
              <Text weight="700" style={[s.trustLabel, { color: item.color }]}>{item.label}</Text>
            </View>
          ))}
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: P.surface },
  scroll: { paddingBottom: 20 },

  // ── Hero block
  heroBlock: {
    paddingTop: 14,
    paddingBottom: 52,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: P.teal,
    shadowColor: P.teal, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 5,
  },
  liveBadgeText: { fontSize: 10, color: P.white, letterSpacing: 1.2 },

  // ── Hero content row
  heroContentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 0,
  },
  heroTextSide: { flex: 1, paddingBottom: 8 },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(34,197,172,0.2)",
    alignSelf: "flex-start",
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(34,197,172,0.35)",
  },
  heroPillText: { fontSize: 10, color: P.teal, letterSpacing: 0.5 },
  heroHeading: {
    fontSize: 34, lineHeight: 40,
    color: P.white,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 12.5, color: "rgba(255,255,255,0.72)",
    lineHeight: 19, maxWidth: 160,
  },

  // ── Phone mockup in hero
  phoneSide: { alignItems: "center", paddingBottom: 0, marginLeft: -6 },
  phone: {
    width: 118, height: 230, borderRadius: 26,
    backgroundColor: "rgba(22,13,56,0.8)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
  },
  phoneSpeaker: {
    position: "absolute", top: 13,
    width: 32, height: 4, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  phoneScreen: {
    width: 98, height: 185, borderRadius: 15,
    backgroundColor: "#0D0823",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", position: "relative",
  },
  phoneHome: {
    position: "absolute", bottom: 10,
    width: 32, height: 4, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  cornerTL: { position:"absolute", top:10, left:10, width:16, height:16, borderTopWidth:2, borderLeftWidth:2, borderColor:P.teal, borderRadius:2 },
  cornerTR: { position:"absolute", top:10, right:10, width:16, height:16, borderTopWidth:2, borderRightWidth:2, borderColor:P.teal, borderRadius:2 },
  cornerBL: { position:"absolute", bottom:10, left:10, width:16, height:16, borderBottomWidth:2, borderLeftWidth:2, borderColor:P.teal, borderRadius:2 },
  cornerBR: { position:"absolute", bottom:10, right:10, width:16, height:16, borderBottomWidth:2, borderRightWidth:2, borderColor:P.teal, borderRadius:2 },
  scanLine: {
    position: "absolute", top: 10, left: 8, right: 8,
    height: 2, backgroundColor: P.teal,
    shadowColor: P.tealGlow, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 8, borderRadius: 1,
  },
  floatingTip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: P.white,
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6,
    marginTop: 10,
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  floatingTipText: { fontSize: 10, color: P.textSub, fontWeight: "700" },

  // ── Hero tail spacer (negative overlap zone)
  heroTail: { height: 0 },

  // ── Action section
  actionSection: {
    paddingHorizontal: 20,
    marginTop: 30,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 10, color: P.textMuted,
    letterSpacing: 1.8, marginBottom: 6,
  },

  // ── Big cards
  bigCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: P.white,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 5,
    minHeight: 90,
  },
  bigCardStripe: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  bigCardBody: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 4,
  },
  bigCardTitle: { fontSize: 16, color: P.text },
  bigCardDesc:  { fontSize: 12, color: P.textMuted, lineHeight: 17 },
  bigCardMeta:  { flexDirection: "row", gap: 6, marginTop: 6 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaChipText: { fontSize: 10, fontWeight: "700" },
  bigCardArrow: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },

  // ── Steps section
  stepsSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  stepsTrack: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    position: "relative",
  },
  trackLine: {
    position: "absolute",
    top: 26,
    left: "17%",
    right: "17%",
    height: 2,
    backgroundColor: P.ghostBorder,
    zIndex: 0,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    zIndex: 1,
    gap: 6,
  },
  stepCircle: {
    width: 52, height: 52, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginBottom: 2,
  },
  stepNumBadge: {
    borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1,
  },
  stepNumText: { fontSize: 10, letterSpacing: 0.5 },
  stepLabel: { fontSize: 12, color: P.text, textAlign: "center" },
  stepSub:   { fontSize: 10, color: P.textMuted, textAlign: "center", lineHeight: 15 },

  // ── Trust strip
  trustStrip: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 18,
    paddingVertical: 16,
  },
  trustItem: { alignItems: "center", gap: 5 },
  trustLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
});